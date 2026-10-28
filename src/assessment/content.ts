/** Public description of the assessment. Contains no questions or answers. */

export const ASSESSMENT_NAME = '10X Customer Support Professional Assessment';
export const CERTIFICATE_TITLE = 'Certificate of Competency in Customer Support';

export const AREAS: { key: string; label: string; questions: number }[] = [
  { key: 'fundamentals', label: 'Customer support fundamentals and customer experience', questions: 3 },
  { key: 'communication', label: 'Communication, empathy and active listening', questions: 4 },
  { key: 'complaints', label: 'Complaint resolution and de-escalation', questions: 4 },
  { key: 'tickets', label: 'Ticket management, prioritisation and SLAs', questions: 4 },
  { key: 'crm', label: 'CRM, support tools and documentation', questions: 3 },
  { key: 'privacy', label: 'Privacy, security, ethics and professional boundaries', questions: 4 },
  { key: 'recovery', label: 'Service recovery and customer retention', questions: 3 },
  { key: 'metrics', label: 'Support metrics and quality assurance', questions: 2 },
  { key: 'judgment', label: 'Escalation, teamwork and situational judgment', questions: 3 },
];

export const areaLabel = (key: string) => AREAS.find((a) => a.key === key)?.label ?? key;

export const CERTIFICATE_NOTE =
  'The certificate is issued by 10X Marketing Solutions to candidates who pass this assessment, and attests to their customer support knowledge and professional judgment.';
