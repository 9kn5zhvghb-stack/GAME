// ==========================================================================
// THAY THẾ toàn bộ object bên dưới bằng config Firebase của CHÍNH BẠN.
// Lấy ở: Firebase Console -> Project Settings -> General -> "Your apps" -> SDK setup and configuration
// ==========================================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
