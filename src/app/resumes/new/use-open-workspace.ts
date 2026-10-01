"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * After a successful build: download the tailored PDF right away, then switch
 * the Resume Builder into that application's workstation (`?app=<id>`) — cover
 * letter, form answers, and proof, without leaving the page. The id lives in
 * the URL, so a refresh keeps the workstation open.
 */
export function useOpenWorkspace(resumeId: string | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (!resumeId) return;
    const a = document.createElement("a");
    a.href = `/api/resumes/${resumeId}/pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    router.replace(`/resumes/new?app=${encodeURIComponent(resumeId)}`);
    window.scrollTo({ top: 0 });
  }, [resumeId, router]);
}
