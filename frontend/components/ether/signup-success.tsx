"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock3, Mail, User } from "lucide-react";

interface SignupSuccessProps {
  username?: string;
  email?: string;
  onSignIn?: () => void;
}

export function SignupSuccess({ username = "john", email = "sample@gmail.com", onSignIn }: SignupSuccessProps) {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (countdown <= 0) {
      onSignIn?.();
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, onSignIn]);

  const handleRedirect = () => {
    onSignIn?.();
  };

  return (
    <div className="signup-page">
      <div className="signup-success-card">
        {/* Header */}
        <div className="signup-success-header">
          <div className="signup-success-badge" aria-hidden="true">
            <User size={28} />
          </div>
          <p className="signup-success-eyebrow">Internet Cafe MANAGEMENT</p>
          <h1 className="signup-success-title">Create Client Account</h1>
          <p className="signup-success-description">
            Register your details and wait for admin approval. We&apos;ll email you only after your account is approved.
          </p>
        </div>

        {/* Success Box */}
        <div className="signup-success-box" role="status" aria-live="polite">
          <div className="signup-success-title-box">
            <CheckCircle size={18} aria-hidden="true" />
            <strong>Registration submitted successfully!</strong>
          </div>

          <ul className="signup-success-details">
            <li>
              <span className="signup-success-icon" aria-hidden="true"><User size={15} /></span>
              <span>Username: <strong>{username}</strong></span>
            </li>
            <li>
              <span className="signup-success-icon" aria-hidden="true"><span className="signup-id-badge">ID</span></span>
              <span>ID Number: <strong>45734519</strong></span>
            </li>
            <li>
              <span className="signup-success-icon" aria-hidden="true"><Mail size={15} /></span>
              <span>Email: <strong>{email}</strong></span>
            </li>
            <li>
              <span className="signup-success-icon" aria-hidden="true"><Clock3 size={15} /></span>
              <span>Status: <strong>Pending admin approval</strong></span>
            </li>
          </ul>

          <div className="signup-success-message">
            <p>Please wait while the administrator reviews your registration.</p>
            <p>Once approved, you will receive an email with a secure link to set your own password.</p>
            <p className="signup-success-countdown">
              You will be redirected to the login page in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}...
            </p>
          </div>
        </div>

        {/* Bottom info box */}
        <div className="signup-success-info">
          <p>Registration submitted. Please wait for admin approval. You will receive an email after approval.</p>
        </div>

        {/* Sign in link */}
        <div className="signup-success-footer">
          <p>
            Already have an account?{" "}
            <button type="button" onClick={handleRedirect} className="signup-success-link">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
