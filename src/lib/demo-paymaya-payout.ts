/**
 * PayMaya / Maya Bank demo helpers for payroll UI.
 * Kept separate from `mock.ts` — do not import `@/lib/mock` here (circular graph
 * caused runtime "is not a function" when those exports were re-exported from mock).
 */

/** Fields needed from the signed-in profile for demo PayMaya defaults. */
export type PaymayaPayoutProfileFields = {
  name: string;
  email: string;
  personalPhone: string;
  employeeNumber: string;
};

/** Convert demo `personalPhone` (+63 …) to local `09…` form for PayMaya mobile fields. */
export function formatDemoPhoneAsPaymayaMobile(personalPhone: string): string {
  const d = personalPhone.replace(/\D/g, "");
  if (d.startsWith("63") && d.length >= 11) {
    return `0${d.slice(2, 12)}`;
  }
  if (d.startsWith("0") && d.length >= 11) {
    return d.slice(0, 11);
  }
  return "";
}

/**
 * Demo defaults for My Pay → PayMaya & Bank: wallet holder name, mobile, and linked email
 * from the signed-in Personal Workplace profile (EMP-0002 … EMP-0009 demo accounts).
 */
export function getDemoPaymayaPayoutDefaults(
  user: PaymayaPayoutProfileFields,
): { accountHolderName: string; paymayaMobile: string; paymayaEmail: string } {
  return {
    accountHolderName: user.name,
    paymayaEmail: user.email.trim(),
    paymayaMobile: formatDemoPhoneAsPaymayaMobile(user.personalPhone),
  };
}

/** Demo linked Visa-style card per EMP-0002 … EMP-0009 (Personal Workplace). PAN shown only masked in UI. */
const DEMO_LINKED_MAYA_CARD_BY_CODE: Record<string, { holder: string; panDigits: string }> = {
  "EMP-0002": { holder: "Glean Ramos", panDigits: "4123456789013210" },
  "EMP-0003": { holder: "Jon Garcia", panDigits: "4123456789015631" },
  "EMP-0004": { holder: "Clinton Galvez", panDigits: "4123456789011142" },
  "EMP-0005": { holder: "Kath Domingo", panDigits: "4123456789017783" },
  "EMP-0006": { holder: "Randy Castro", panDigits: "4123456789016674" },
  "EMP-0007": { holder: "Francis Lopez", panDigits: "4123456789018895" },
  "EMP-0008": { holder: "Lani Rivera", panDigits: "4123456789011126" },
  "EMP-0009": { holder: "Anthony Torres", panDigits: "4123456789019907" },
};

export function getDemoLinkedMayaCard(employeeNumber: string): {
  cardHolderName: string;
  cardNumberMasked: string;
} | null {
  const code = employeeNumber.trim().toUpperCase();
  const row = DEMO_LINKED_MAYA_CARD_BY_CODE[code];
  if (!row) return null;
  const d = row.panDigits;
  const masked = d.length >= 4 ? `**** **** **** ${d.slice(-4)}` : "";
  return { cardHolderName: row.holder, cardNumberMasked: masked };
}
