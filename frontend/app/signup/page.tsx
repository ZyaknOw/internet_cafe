"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignupForm } from "@/components/ether/signup-form";
import type { SignupFormValues } from "@/components/ether/signup-form";
import { SignupSuccess } from "@/components/ether/signup-success";
import { supabase } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SignupPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const handleSubmit = async (values: SignupFormValues) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Try public backend register endpoint
      const response = await fetch(`${API_URL}/api/public/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          middleName: values.middleName.trim() || undefined,
          lastName: values.lastName.trim(),
          address: values.address.trim(),
          contact: values.mobile.trim(),
          email: values.email.trim().toLowerCase(),
          dateOfBirth: values.dateOfBirth.trim() || undefined,
          gender: values.gender,
          emergencyContact: values.emergencyContact.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 409 || response.status === 400) {
          setErrorMessage(data.error || "An account with these details already exists.");
          return;
        }
        throw new Error(data.error || "Failed to submit registration via backend");
      }

      setEmail(values.email);
      setSubmitted(true);
      return;
    } catch (err: unknown) {
      // 2. Fallback: try direct Supabase table insert
      try {
        const { data: existingProfiles } = await supabase
          .from("account_profiles")
          .select("id, first_name, last_name, email, contact");

        if (existingProfiles && existingProfiles.length > 0) {
          const normEmail = values.email.trim().toLowerCase();
          const normFirst = values.firstName.trim().toLowerCase().replace(/\s+/g, " ");
          const normLast = values.lastName.trim().toLowerCase().replace(/\s+/g, " ");
          const normContact = values.mobile.replace(/[\s\-\(\)\+]/g, "");

          for (const p of existingProfiles) {
            const pFirst = (p.first_name || "").trim().toLowerCase().replace(/\s+/g, " ");
            const pLast = (p.last_name || "").trim().toLowerCase().replace(/\s+/g, " ");
            const pEmail = (p.email || "").trim().toLowerCase();
            const pContact = (p.contact || "").replace(/[\s\-\(\)\+]/g, "");

            if (pEmail === normEmail) {
              setErrorMessage("An account with this email address already exists.");
              return;
            }
            if (pFirst === normFirst && pLast === normLast) {
              setErrorMessage(`An account for "${values.firstName.trim()} ${values.lastName.trim()}" already exists. Every account must have a unique first and last name.`);
              return;
            }
            if (normContact.length >= 7 && pContact.length >= 7 && pContact === normContact) {
              setErrorMessage("An account with this mobile/contact number already exists.");
              return;
            }
          }
        }

        const { error: sbError } = await supabase.from("account_profiles").insert({
          first_name: values.firstName.trim(),
          middle_name: values.middleName.trim() || null,
          last_name: values.lastName.trim(),
          address: values.address.trim(),
          contact: values.mobile.trim(),
          email: values.email.trim().toLowerCase(),
          role: "customer",
          status: "pending",
        });

        if (!sbError) {
          setEmail(values.email);
          setSubmitted(true);
          return;
        }

        if (sbError.code === "23505") {
          setErrorMessage("An account with this email already exists.");
          return;
        }

        setErrorMessage(
          err instanceof Error ? err.message : "Unable to submit account registration. Please check your connection or contact staff."
        );
      } catch {
        setErrorMessage("Unable to submit account registration. Please try again later.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SignupSuccess email={email} onSignIn={() => router.push("/")} />;
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: "12px 16px",
              marginBottom: "16px",
              background: "#fee2e2",
              border: "1px solid #f87171",
              borderRadius: "10px",
              color: "#991b1b",
              fontSize: "13.5px",
              fontWeight: 500,
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}
        <SignupForm onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </div>
  );
}
