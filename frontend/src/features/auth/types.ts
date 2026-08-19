export interface CandidateProfile {
  phone: string;
  location: string;
  headline: string;
  bio: string;
  years_of_experience: number;
  current_job_title: string;
  current_company: string;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: CandidateProfile;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface RegistrationPayload extends AuthPayload {
  first_name: string;
  last_name: string;
}

export interface AuthResult {
  access: string;
  refresh: string;
  user: AuthUser;
}
