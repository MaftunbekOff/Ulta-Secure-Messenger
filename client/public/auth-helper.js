// Quick auth helper for testing
function setAuthToken() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5OGJmYjgxOS05NjFiLTRlMmYtOTIyYi0wMjA3N2FiY2U1MjMiLCJpYXQiOjE3NTcwNTM1NTIsImV4cCI6MTc1NzY1ODM1Mn0.BoF0dwylGKWlKe8u2BHNNiyc2B34ykeIVTuTzoYcOwo";
  localStorage.setItem('token', token);
  console.log('🔑 Token saved! Refresh the page to see your messages.');
  window.location.reload();
}

// Auto-set token if not present
if (!localStorage.getItem('token')) {
  setAuthToken();
}