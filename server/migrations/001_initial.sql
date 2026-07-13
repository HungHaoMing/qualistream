CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE member_role AS ENUM ('owner', 'researcher');
CREATE TYPE code_status AS ENUM ('active', 'archived');
CREATE TYPE coding_status AS ENUM ('valid', 'needs_review');
CREATE TYPE case_role AS ENUM ('participant', 'researcher');
CREATE TYPE attribute_type AS ENUM ('text', 'number', 'boolean', 'date', 'enum');

CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), firebase_uid text NOT NULL UNIQUE, email text, display_name text, approved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name))>0), description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE project_members (project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role member_role NOT NULL DEFAULT 'researcher', PRIMARY KEY(project_id,user_id));
CREATE TABLE interviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, interview_date date, title text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name text NOT NULL CHECK(length(trim(name))>0), role case_role NOT NULL DEFAULT 'participant', aliases text[] NOT NULL DEFAULT '{}', memo text NOT NULL DEFAULT '', anonymous_number integer NOT NULL CHECK(anonymous_number>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id), UNIQUE(project_id,role,anonymous_number));
CREATE TABLE speakers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE, label text NOT NULL, role case_role NOT NULL DEFAULT 'participant', case_id uuid REFERENCES cases(id) ON DELETE SET NULL, UNIQUE(interview_id,label));
CREATE TABLE segments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), interview_id uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE, speaker_id uuid REFERENCES speakers(id) ON DELETE SET NULL, display_order integer NOT NULL CHECK(display_order>=0), source_reference text, text text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '', timestamp_ms integer CHECK(timestamp_ms IS NULL OR timestamp_ms>=0), text_version integer NOT NULL DEFAULT 1 CHECK(text_version>0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(interview_id,display_order));
CREATE TABLE codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, parent_id uuid REFERENCES codes(id) ON DELETE RESTRICT, name text NOT NULL CHECK(length(trim(name))>0), definition text NOT NULL DEFAULT '', inclusion_criteria text NOT NULL DEFAULT '', exclusion_criteria text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '#6366f1' CHECK(color ~ '^#[0-9A-Fa-f]{6}$'), sort_order integer NOT NULL DEFAULT 0, status code_status NOT NULL DEFAULT 'active', memo text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,id));
CREATE TABLE codings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, segment_id uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE, code_id uuid NOT NULL REFERENCES codes(id) ON DELETE RESTRICT, start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL CHECK(end_offset>start_offset), selected_text text NOT NULL CHECK(length(selected_text)>0), context_before text NOT NULL DEFAULT '', context_after text NOT NULL DEFAULT '', segment_text_version integer NOT NULL CHECK(segment_text_version>0), memo text NOT NULL DEFAULT '', status coding_status NOT NULL DEFAULT 'valid', proposed_start integer, proposed_end integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(segment_id,code_id,start_offset,end_offset));
CREATE TABLE attribute_definitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name text NOT NULL, data_type attribute_type NOT NULL, enum_options jsonb NOT NULL DEFAULT '[]', required boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, UNIQUE(project_id,name));
CREATE TABLE case_attribute_values (case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE, definition_id uuid NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE, value jsonb NOT NULL, PRIMARY KEY(case_id,definition_id));
CREATE INDEX interviews_project_idx ON interviews(project_id); CREATE INDEX segments_interview_idx ON segments(interview_id,display_order); CREATE INDEX codes_project_idx ON codes(project_id,sort_order); CREATE INDEX codings_project_idx ON codings(project_id,code_id); CREATE INDEX cases_project_idx ON cases(project_id);

CREATE FUNCTION prevent_code_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE bad boolean; BEGIN
 IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
 WITH RECURSIVE a AS (SELECT id,parent_id,project_id FROM codes WHERE id=NEW.parent_id UNION ALL SELECT c.id,c.parent_id,c.project_id FROM codes c JOIN a ON c.id=a.parent_id)
 SELECT EXISTS(SELECT 1 FROM a WHERE id=NEW.id OR project_id<>NEW.project_id) INTO bad;
 IF NEW.parent_id=NEW.id OR bad THEN RAISE EXCEPTION 'invalid code hierarchy'; END IF; RETURN NEW; END $$;
CREATE TRIGGER codes_no_cycle BEFORE INSERT OR UPDATE OF parent_id,project_id ON codes FOR EACH ROW EXECUTE FUNCTION prevent_code_cycle();

CREATE FUNCTION validate_coding_scope() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE sp uuid; cp uuid; ver integer; BEGIN
 SELECT i.project_id,s.text_version INTO sp,ver FROM segments s JOIN interviews i ON i.id=s.interview_id WHERE s.id=NEW.segment_id;
 SELECT project_id INTO cp FROM codes WHERE id=NEW.code_id;
 IF sp IS NULL OR sp<>NEW.project_id OR cp<>NEW.project_id THEN RAISE EXCEPTION 'coding project mismatch'; END IF;
 IF NEW.segment_text_version<>ver THEN RAISE EXCEPTION 'stale segment version'; END IF; RETURN NEW; END $$;
CREATE TRIGGER codings_scope BEFORE INSERT OR UPDATE OF segment_id,code_id,start_offset,end_offset,selected_text,segment_text_version ON codings FOR EACH ROW EXECUTE FUNCTION validate_coding_scope();

CREATE FUNCTION validate_case_attribute() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE expected attribute_type; opts jsonb; cp uuid; dp uuid; BEGIN
 SELECT project_id INTO cp FROM cases WHERE id=NEW.case_id; SELECT project_id,data_type,enum_options INTO dp,expected,opts FROM attribute_definitions WHERE id=NEW.definition_id;
 IF cp<>dp THEN RAISE EXCEPTION 'attribute project mismatch'; END IF;
 IF (expected='text' AND jsonb_typeof(NEW.value)<>'string') OR (expected='number' AND jsonb_typeof(NEW.value)<>'number') OR (expected='boolean' AND jsonb_typeof(NEW.value)<>'boolean') OR (expected='date' AND (jsonb_typeof(NEW.value)<>'string' OR NOT (NEW.value#>>'{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) OR (expected='enum' AND NOT opts @> jsonb_build_array(NEW.value)) THEN RAISE EXCEPTION 'invalid attribute value'; END IF; RETURN NEW; END $$;
CREATE TRIGGER case_attribute_valid BEFORE INSERT OR UPDATE ON case_attribute_values FOR EACH ROW EXECUTE FUNCTION validate_case_attribute();
