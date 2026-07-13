import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const configured = Object.values(config).every(Boolean)
const auth = configured ? getAuth(initializeApp(config)) : null
export function firebaseConfigured() { return configured }
export function observeAuth(callback) { if (!auth) { callback(null); return ()=>{} } return onAuthStateChanged(auth, callback) }
export function googleSignIn() { if (!auth) throw new Error('Firebase 尚未設定'); return signInWithPopup(auth, new GoogleAuthProvider()) }
export function logout() { return auth ? signOut(auth) : Promise.resolve() }
export function getIdToken() { return auth?.currentUser?.getIdToken() || Promise.resolve(null) }
