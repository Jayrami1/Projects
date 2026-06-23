import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import styles from './Login.module.css';

export const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Required for registration
  const { dispatch } = useAuth();
  const navigate = useNavigate();

  // Eventually login page is a form
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    // Mock user for initial setup
    e.preventDefault();
    // Choosing endpoint
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering
      ? { name, email, user_password: password }
      : { email, user_password: password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');
      if (isRegistering) {
        alert('Registration successful! Please login.');
        setIsRegistering(false);
      } else {
        // payload in LOGIN action stores the User object
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        dispatch({ type: 'LOGIN', payload: data.user });
        navigate('/projects');
      }
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Unknown error occurred');
      }
    }
  };

  return (
    <div className={styles.loginWrapper}>
      <form className={styles.loginContainer} onSubmit={handleSubmit}>
        <h1>{isRegistering ? 'Register' : 'Login'}</h1>
        {isRegistering && (
          <div className={styles.formGroup}>
            <input
              type="text"
              className={styles.input}
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div className={styles.formGroup}>
          <input
            type="email"
            className={styles.input}
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <input
            type="password"
            className={styles.input}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className={styles.submitBtn}>
          {isRegistering ? 'Register' : 'Login'}
        </button>
        <p className={styles.toggleText}>
          {isRegistering ? (
            <>
              Already have an account?{' '}
              <span
                className={styles.link}
                onClick={() => setIsRegistering(false)}
              >
                Login
              </span>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <span
                className={styles.link}
                onClick={() => setIsRegistering(true)}
              >
                Register Now
              </span>
            </>
          )}
        </p>
      </form>
    </div>
  );
};
