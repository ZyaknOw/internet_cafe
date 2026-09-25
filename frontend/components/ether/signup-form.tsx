"use client";

import { useState, useId } from "react";
import { AlertCircle, Calendar, Coffee, Mail, Phone, Shield, User } from "lucide-react";

type Gender = "male" | "female" | "prefer-not-to-say";

export interface SignupFormValues {
  email: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  dateOfBirth: string;
  gender: Gender;
  mobile: string;
  emergencyContact: string;
  address: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

export interface SignupFormProps {
  onSubmit?: (values: SignupFormValues) => void | Promise<void>;
  submitting?: boolean;
}

const emptyValues: SignupFormValues = {
  email: "",
  lastName: "",
  firstName: "",
  middleName: "",
  suffix: "",
  dateOfBirth: "",
  gender: "prefer-not-to-say",
  mobile: "",
  emergencyContact: "",
  address: "",
  agreeTerms: false,
  agreePrivacy: false,
};

export function SignupForm({ onSubmit, submitting = false }: SignupFormProps) {
  const [values, setValues] = useState<SignupFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const emailFieldId = useId();
  const lastNameFieldId = useId();
  const firstNameFieldId = useId();
  const middleFieldId = useId();
  const suffixFieldId = useId();
  const dobFieldId = useId();
  const genderFieldId = useId();
  const mobileFieldId = useId();
  const emergencyFieldId = useId();
  const addressFieldId = useId();
  const termsFieldId = useId();
  const privacyFieldId = useId();

  const setField = <K extends keyof SignupFormValues>(key: K, value: SignupFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!values.email.trim()) next.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Please enter a valid email address";
    if (!values.lastName.trim()) next.lastName = "Last name is required";
    if (!values.firstName.trim()) next.firstName = "First name is required";
    if (!values.dateOfBirth.trim()) next.dateOfBirth = "Date of birth is required";
    if (!values.mobile.trim()) next.mobile = "Mobile number is required";
    else if (!/^\+?[0-9]{10,13}$/.test(values.mobile.replace(/\s/g, ""))) next.mobile = "Enter a valid mobile number (10–13 digits)";
    if (!values.address.trim()) next.address = "Complete address is required";
    if (!values.agreeTerms) next.agreeTerms = "You must accept the Terms & Conditions";
    if (!values.agreePrivacy) next.agreePrivacy = "You must consent to data collection under RA 10173";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit?.(values);
  };

  const inputStyle = (fieldError?: string) => ({
    width: "100%",
    padding: "12px 14px",
    border: `1px solid ${fieldError ? "var(--danger)" : "var(--border)"}`,
    borderRadius: 12,
    background: "var(--cream)",
    color: "var(--ink)",
    outline: 0,
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    fontSize: 14,
  });

  return (
    <div className="signup-page">
      <div className="signup-card">
        {/* Header */}
        <div className="signup-header">
          <div className="signup-badge" aria-hidden="true">
            <Coffee size={22} />
          </div>
          <p className="signup-eyebrow">Internet Cafe MANAGEMENT</p>
          <h1 className="signup-title">Create Client Account</h1>
          <p className="signup-description">
            Register your details and wait for admin approval. We&apos;ll email you only after your account is approved.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Account Information */}
          <fieldset className="signup-section">
            <legend className="signup-section-title">Account Information</legend>
            <p className="signup-section-note">Use your real email. You will create your own password after approval.</p>

            <div className="signup-field">
              <label htmlFor={emailFieldId}>Email Address <span aria-hidden="true">*</span></label>
              <div className="signup-input-wrap">
                <Mail size={16} aria-hidden="true" />
                <input
                  id={emailFieldId}
                  type="email"
                  value={values.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="juan.delacruz@gmail.com"
                  style={inputStyle(errors.email)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? `${emailFieldId}-error` : undefined}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p id={`${emailFieldId}-error`} className="signup-error" role="alert">
                  <AlertCircle size={13} aria-hidden="true" /> {errors.email}
                </p>
              )}
            </div>

            <div className="signup-notice" role="note">
              <div className="signup-notice-header">
                <Shield size={14} aria-hidden="true" />
                <strong>AUTOMATIC USERNAME</strong>
              </div>
              <p>Your username will be generated automatically from your first name.</p>
            </div>
          </fieldset>

          {/* Personal Information */}
          <fieldset className="signup-section">
            <legend className="signup-section-title">Personal Information</legend>

            <div className="signup-grid">
              <div className="signup-field">
                <label htmlFor={lastNameFieldId}>Last Name <span aria-hidden="true">*</span></label>
                <div className="signup-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input
                    id={lastNameFieldId}
                    type="text"
                    value={values.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    placeholder="Dela Cruz"
                    style={inputStyle(errors.lastName)}
                    aria-invalid={!!errors.lastName}
                    aria-describedby={errors.lastName ? `${lastNameFieldId}-error` : undefined}
                    autoComplete="family-name"
                  />
                </div>
                {errors.lastName && (
                  <p id={`${lastNameFieldId}-error`} className="signup-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {errors.lastName}
                  </p>
                )}
              </div>

              <div className="signup-field">
                <label htmlFor={firstNameFieldId}>First Name <span aria-hidden="true">*</span></label>
                <div className="signup-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input
                    id={firstNameFieldId}
                    type="text"
                    value={values.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    placeholder="Juan"
                    style={inputStyle(errors.firstName)}
                    aria-invalid={!!errors.firstName}
                    aria-describedby={errors.firstName ? `${firstNameFieldId}-error` : undefined}
                    autoComplete="given-name"
                  />
                </div>
                {errors.firstName && (
                  <p id={`${firstNameFieldId}-error`} className="signup-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {errors.firstName}
                  </p>
                )}
              </div>

              <div className="signup-field">
                <label htmlFor={middleFieldId}>Middle Name</label>
                <div className="signup-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input
                    id={middleFieldId}
                    type="text"
                    value={values.middleName}
                    onChange={(e) => setField("middleName", e.target.value)}
                    placeholder="Santos"
                    style={inputStyle()}
                    autoComplete="additional-name"
                  />
                </div>
              </div>

              <div className="signup-field">
                <label htmlFor={suffixFieldId}>Suffix</label>
                <div className="signup-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input
                    id={suffixFieldId}
                    type="text"
                    value={values.suffix}
                    onChange={(e) => setField("suffix", e.target.value)}
                    placeholder="Jr. / Sr. / III"
                    style={inputStyle()}
                  />
                </div>
              </div>

              <div className="signup-field">
                <label htmlFor={dobFieldId}>Date of Birth <span aria-hidden="true">*</span></label>
                <div className="signup-input-wrap">
                  <Calendar size={16} aria-hidden="true" />
                  <input
                    id={dobFieldId}
                    type="date"
                    value={values.dateOfBirth}
                    onChange={(e) => setField("dateOfBirth", e.target.value)}
                    style={inputStyle(errors.dateOfBirth)}
                    aria-invalid={!!errors.dateOfBirth}
                    aria-describedby={errors.dateOfBirth ? `${dobFieldId}-error` : undefined}
                  />
                </div>
                {errors.dateOfBirth && (
                  <p id={`${dobFieldId}-error`} className="signup-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {errors.dateOfBirth}
                  </p>
                )}
              </div>

              <div className="signup-field">
                <label htmlFor={genderFieldId}>Gender</label>
                <div className="signup-input-wrap">
                  <User size={16} aria-hidden="true" style={{ opacity: 0.6 }} />
                  <select
                    id={genderFieldId}
                    value={values.gender}
                    onChange={(e) => setField("gender", e.target.value as Gender)}
                    style={inputStyle()}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Contact Information */}
          <fieldset className="signup-section">
            <legend className="signup-section-title">Contact Information</legend>

            <div className="signup-grid">
              <div className="signup-field">
                <label htmlFor={mobileFieldId}>Mobile Phone Number <span aria-hidden="true">*</span></label>
                <div className="signup-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <input
                    id={mobileFieldId}
                    type="tel"
                    value={values.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                    placeholder="09123456789"
                    style={inputStyle(errors.mobile)}
                    aria-invalid={!!errors.mobile}
                    aria-describedby={errors.mobile ? `${mobileFieldId}-error` : undefined}
                    autoComplete="tel"
                  />
                </div>
                {errors.mobile && (
                  <p id={`${mobileFieldId}-error`} className="signup-error" role="alert">
                    <AlertCircle size={13} aria-hidden="true" /> {errors.mobile}
                  </p>
                )}
              </div>

              <div className="signup-field">
                <label htmlFor={emergencyFieldId}>Emergency Contact</label>
                <div className="signup-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <input
                    id={emergencyFieldId}
                    type="tel"
                    value={values.emergencyContact}
                    onChange={(e) => setField("emergencyContact", e.target.value)}
                    placeholder="Emergency Contact - 09123456789"
                    style={inputStyle()}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>

            <div className="signup-field">
              <label htmlFor={addressFieldId}>Complete Address <span aria-hidden="true">*</span></label>
              <textarea
                id={addressFieldId}
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="Street, Barangay, City, Province"
                rows={3}
                style={{ ...inputStyle(errors.address), resize: "vertical" }}
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? `${addressFieldId}-error` : undefined}
              />
              {errors.address && (
                <p id={`${addressFieldId}-error`} className="signup-error" role="alert">
                  <AlertCircle size={13} aria-hidden="true" /> {errors.address}
                </p>
              )}
            </div>
          </fieldset>

          {/* Compliance & Consent */}
          <fieldset className="signup-section signup-consent-section">
            <legend className="signup-section-title">Compliance &amp; Consent</legend>

            <div className="signup-consents">
              <label className="signup-checkbox-label">
                <input
                  id={termsFieldId}
                  type="checkbox"
                  checked={values.agreeTerms}
                  onChange={(e) => setField("agreeTerms", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--olive)", flex: "none" }}
                />
                <span>
                  I agree to the{" "}
                  <button type="button" className="signup-link-btn">
                    Terms &amp; Conditions
                  </button>
                  ,{" "}
                  <button type="button" className="signup-link-btn">
                    Privacy Policy
                  </button>
                  , and{" "}
                  <button type="button" className="signup-link-btn">
                    Cookie Policy
                  </button>
                  .
                </span>
              </label>
              {errors.agreeTerms && (
                <p className="signup-error" role="alert">
                  <AlertCircle size={13} aria-hidden="true" /> {errors.agreeTerms}
                </p>
              )}

              <label className="signup-checkbox-label">
                <input
                  id={privacyFieldId}
                  type="checkbox"
                  checked={values.agreePrivacy}
                  onChange={(e) => setField("agreePrivacy", e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--olive)", flex: "none" }}
                />
                <span>
                  I consent to data collection for account verification in accordance with{" "}
                  <strong>RA 10173 (Data Privacy Act)</strong>.
                </span>
              </label>
              {errors.agreePrivacy && (
                <p className="signup-error" role="alert">
                  <AlertCircle size={13} aria-hidden="true" /> {errors.agreePrivacy}
                </p>
              )}
            </div>

            <button type="submit" className="signup-submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Register Account"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
