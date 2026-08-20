export interface Resume {
  id: number;
  title: string;
  file_name: string;
  file_type: string;
  file_size: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResumeUpload {
  title: string;
  file: File;
}
