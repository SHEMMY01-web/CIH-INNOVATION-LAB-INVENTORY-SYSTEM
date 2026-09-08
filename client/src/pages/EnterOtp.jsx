import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/enter_otp.css';

export default function EnterOtp() {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate verification
    navigate('/login_successful');
  };

  return (
    <div className="split-layout">
      {/* Left side light blue background */}
      <div className="split-left"></div>
      
      {/* Right side form */}
      <div className="split-right">
        <div className="auth-container">
          <Link to="/forgot_password" className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Back
          </Link>
          
          <div className="auth-header">
            <h1>Enter OTP</h1>
            <p>
              We have shared a code to your registered email address<br />
              mathew.west@ienetworksolutions.com
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="otp-inputs">
              <input type="text" maxLength="1" className="otp-field" defaultValue="5" />
              <input type="text" maxLength="1" className="otp-field" defaultValue="0" />
              <input type="text" maxLength="1" className="otp-field" />
              <input type="text" maxLength="1" className="otp-field" />
            </div>
            
            <input type="submit" className="btn-primary" value="Verify" />
          </form>
        </div>
      </div>
    </div>
  );
}
