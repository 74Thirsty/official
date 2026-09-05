export default {
  id: 'suspend-volunteer',
  intent: 'Suspend a Volunteer',
  domain: 'People',
  idPrefix: 'VOL',
  titleField: { name: 'volunteer_name', label: 'Volunteer Name' },
  summary: 'Suspend a volunteer on safety, investigation, or conduct grounds. The suspension records the date, reason, authority, whether the volunteer may perform any other duties, return conditions, and follow-up responsibility.',
  source: [
    { id: 'VOL-PROC-001', section: 'Suspension' },
  ],
  intake: [
    { name: 'volunteer_name', label: 'Volunteer Name', type: 'text', required: true, maxlen: 80 },
    { name: 'volunteer_reference', label: 'Volunteer Reference', type: 'text', required: true, maxlen: 40 },
    { name: 'assignment_reference', label: 'Assignment Reference', type: 'text', required: true, maxlen: 80 },
    { name: 'suspension_reason', label: 'Suspension Reason', type: 'textarea', required: true, maxlen: 2000, help: 'The specific reason for suspension (safety, investigation, or conduct)' },
    { name: 'suspended_by', label: 'Suspended By', type: 'text', required: true, maxlen: 80 },
  ],
  requirements: [
    {
      id: 'record-suspension',
      title: 'Record the Suspension',
      instructions: 'Complete the Volunteer Suspension Record (VOL-FORM-011) with: the date, the specific reason, the authority suspending the volunteer, whether the volunteer may perform any other duties, return conditions, and follow-up responsibility.',
      purpose: 'Suspension is formal, documented, and limited.',
      role: 'Authorized authority',
      source: { id: 'VOL-PROC-001', section: 'Suspension' },
      documents: [
        { id: 'VOL-FORM-011', note: 'Suspension Record' },
      ],
      evidence: { type: 'TEXT', label: 'Suspension recorded' },
    },
    {
      id: 'notify-volunteer',
      title: 'Notify the Volunteer',
      instructions: 'Notify the volunteer of the suspension: the reason, the effective date, the scope (all duties or specific), the return conditions, and how to follow up.',
      purpose: 'The volunteer is informed clearly and promptly.',
      role: 'Supervisor / Coordinator',
      source: { id: 'VOL-PROC-001', section: 'Suspension' },
      documents: [],
      evidence: { type: 'TEXT', label: 'Volunteer notified' },
    },
    {
      id: 'update-register',
      title: 'Update the Volunteer Register',
      instructions: 'Update the Volunteer Register (VOL-REG-001) and the volunteer file to reflect the suspended status, with the suspension date and reason.',
      purpose: 'The register reflects the volunteer is not active.',
      role: 'Records',
      source: { id: 'VOL-PROC-001', section: 'Suspension' },
      documents: [
        { id: 'VOL-REG-001', note: 'Volunteer Register' },
      ],
      evidence: { type: 'TEXT', label: 'Register updated' },
    },
  ],
};
