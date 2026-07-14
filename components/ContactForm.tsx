interface ContactFormProps {
  form: {
    fullName: string;
    jobTitle: string;
    company: string;

    mobileNumbers: string[];
    telephoneNumbers: string[];

    emails: string[];

    website: string;
    address: string;
    companyLocation: string;
    linkedin: string;
  };

  updateField: (
    key: keyof ContactFormProps["form"],
    value: string
  ) => void;

  updateArrayField: (
    key: "mobileNumbers" | "telephoneNumbers" | "emails",
    index: number,
    value: string
  ) => void;

  addArrayItem: (
    key: "mobileNumbers" | "telephoneNumbers" | "emails"
  ) => void;

  removeArrayItem: (
    key: "mobileNumbers" | "telephoneNumbers" | "emails",
    index: number
  ) => void;
}