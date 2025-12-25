import { generateText, generateObject } from "ai"
import { z } from "zod"

// Simulated compliance knowledge base - in production, this would be a vector database
const COMPLIANCE_KNOWLEDGE_BASE = [
  {
    id: "GDPR-001",
    framework: "GDPR",
    title: "Personal Data Collection Consent",
    content:
      "Systems must obtain explicit consent before collecting personal data. Users must be informed of data usage and retention policies.",
    severity: "high",
    source: "GDPR Article 6(1)(a)",
  },
  {
    id: "HIPAA-001",
    framework: "HIPAA",
    title: "Protected Health Information Security",
    content:
      "Healthcare applications must implement encryption for PHI at rest and in transit. Access controls must be role-based.",
    severity: "high",
    source: "HIPAA Security Rule 164.312",
  },
  {
    id: "SOC2-001",
    framework: "SOC 2",
    title: "Access Control Management",
    content: "Systems must implement multi-factor authentication for privileged accounts and maintain audit logs.",
    severity: "medium",
    source: "SOC 2 CC6.1",
  },
  {
    id: "PCI-DSS-001",
    framework: "PCI DSS",
    title: "Payment Card Data Storage",
    content: "Never store full magnetic stripe, card validation code, or PIN data. Encrypt cardholder data at rest.",
    severity: "high",
    source: "PCI DSS Requirement 3.2",
  },
  {
    id: "OWASP-001",
    framework: "OWASP",
    title: "SQL Injection Prevention",
    content: "Use parameterized queries or prepared statements. Never concatenate user input into SQL queries.",
    severity: "high",
    source: "OWASP Top 10 A03:2021",
  },
  {
    id: "ISO27001-001",
    framework: "ISO 27001",
    title: "Password Policy",
    content: "Implement minimum password length of 12 characters, complexity requirements, and password history.",
    severity: "medium",
    source: "ISO/IEC 27001:2013 A.9.4.3",
  },
  {
    id: "NIST-001",
    framework: "NIST",
    title: "Logging and Monitoring",
    content: "Systems should log security events, authentication attempts, and data access with timestamps.",
    severity: "low",
    source: "NIST SP 800-53 AU-2",
  },
  {
    id: "WCAG-001",
    framework: "WCAG",
    title: "Web Accessibility",
    content: "Applications should be perceivable, operable, understandable, and robust for users with disabilities.",
    severity: "low",
    source: "WCAG 2.1 Level AA",
  },
]

const CRITICAL_VIOLATIONS = [
  {
    keywords: ["credit card", "email", "send", "transmit"],
    matchAll: true,
    secondaryCheck: (text: string) => {
      const hasProcessor = text.includes("stripe") || text.includes("payment processor") || text.includes("paypal")
      const hasCreditCardEmail = text.includes("credit card") && (text.includes("email") || text.includes("send"))
      return hasCreditCardEmail && !hasProcessor
    },
    violation: {
      code: "PCI-DSS-BLOCK-001",
      framework: "PCI DSS",
      title: "Credit Card Data via Email - PROHIBITED",
      description:
        "Your project description mentions sending credit card information through email. This is a CRITICAL PCI DSS violation and is never acceptable under any circumstances.",
      severity: "high" as const,
      source: "PCI DSS Requirement 4.2",
      coaching:
        "Email is NOT a secure channel for transmitting payment card data. It lacks encryption, authentication, and audit trails required by PCI DSS. This practice exposes customers to fraud and your business to massive fines and liability.",
      requiredActions: [
        "Remove any email transmission of credit card data immediately",
        "Use a PCI DSS compliant payment processor (Stripe, Square, PayPal, etc.)",
        "Implement tokenization - never store or transmit full card numbers",
        "Use TLS 1.2+ encrypted connections for all payment processing",
        "Consult with a PCI DSS qualified security assessor (QSA)",
      ],
      blockGeneration: true,
    },
  },
  {
    keywords: ["collect", "store", "process"],
    matchAll: false,
    secondaryCheck: (text: string) => {
      const hasHealthData =
        text.includes("health") ||
        text.includes("medical") ||
        text.includes("patient") ||
        text.includes("diagnosis") ||
        text.includes("prescription")
      const hasProperMentions =
        text.includes("hipaa") || text.includes("encrypted") || text.includes("secure") || text.includes("compliant")

      // Only block if handling health data WITHOUT mentioning compliance
      return hasHealthData && !hasProperMentions
    },
    violation: {
      code: "HIPAA-BLOCK-001",
      framework: "HIPAA",
      title: "Health Information Handling - HIPAA Compliance Required",
      description:
        "Your project involves collecting or processing health information without mentioning HIPAA compliance measures. This requires extensive security infrastructure.",
      severity: "high" as const,
      source: "HIPAA Privacy Rule 45 CFR Part 160",
      coaching:
        "Health information (PHI/ePHI) requires HIPAA-compliant infrastructure. Before proceeding, ensure you have: end-to-end encryption, access controls, audit logging, business associate agreements, and breach notification procedures. HIPAA violations can result in fines up to $1.5M per violation category per year.",
      requiredActions: [
        "Implement end-to-end encryption for all health data (AES-256)",
        "Establish role-based access controls with audit logging",
        "Create Business Associate Agreements (BAAs) with all vendors",
        "Implement breach detection and notification procedures",
        "Conduct regular HIPAA security risk assessments",
        "Consult with a HIPAA compliance attorney before proceeding",
      ],
      blockGeneration: true,
    },
  },
  {
    keywords: ["medical", "diagnos", "prescri", "treatment", "health advice"],
    matchAll: false,
    violation: {
      code: "FDA-BLOCK-001",
      framework: "FDA/Medical",
      title: "Medical Recommendations - FDA Regulation Required",
      description:
        "Providing medical advice, diagnoses, or treatment recommendations may require FDA approval and medical licensing. This is a highly regulated area with serious legal implications.",
      severity: "high" as const,
      source: "FDA 21 CFR Part 11, State Medical Practice Acts",
      coaching:
        "Software that provides medical diagnoses, treatment recommendations, or drug prescriptions is regulated as a medical device by the FDA. Operating without proper approval can result in criminal charges, injunctions, and civil penalties.",
      requiredActions: [
        "Clearly disclaim that your service is NOT medical advice",
        "Require users to consult licensed healthcare providers",
        "Do not make health claims that require FDA substantiation",
        "Consult with healthcare regulatory attorneys",
        "Consider whether your software qualifies as a medical device under FDA guidelines",
        "If providing supplement recommendations, ensure FDA/FTC compliance for health claims",
      ],
      blockGeneration: false, // Warning but allow with disclaimer
    },
  },
]

// Function to detect auto-compliance requirements
function detectAutoComplianceRequirements(projectTitle: string, projectDescription: string) {
  const fullText = `${projectTitle} ${projectDescription}`.toLowerCase()
  const detectedRequirements = []

  for (const pattern of AUTO_COMPLIANCE_PATTERNS) {
    let matches = false

    if (pattern.matchAll) {
      matches = pattern.keywords.every((keyword) => fullText.includes(keyword.toLowerCase()))
    } else {
      matches = pattern.keywords.some((keyword) => fullText.includes(keyword.toLowerCase()))
    }

    if (matches) {
      detectedRequirements.push(...pattern.requirements)
    }
  }

  return detectedRequirements
}

// RAG retrieval function
async function retrieveRelevantCompliance(projectDescription: string) {
  try {
    const { object } = await generateObject({
      model: "google/gemini-2.5-pro",
      schema: z.object({
        relevantFrameworks: z.array(z.string()).describe("Compliance frameworks relevant to this project"),
        keywords: z.array(z.string()).describe("Key compliance-related keywords found"),
      }),
      prompt: `Analyze this project description and identify relevant compliance frameworks and keywords:
    
Project: ${projectDescription}

Consider frameworks like GDPR, HIPAA, SOC 2, PCI DSS, OWASP, ISO 27001, NIST, WCAG.`,
    })

    // Filter knowledge base based on relevance
    const relevantDocs = COMPLIANCE_KNOWLEDGE_BASE.filter(
      (doc) =>
        object.relevantFrameworks.some((framework) => doc.framework.toLowerCase().includes(framework.toLowerCase())) ||
        object.keywords.some(
          (keyword) =>
            doc.content.toLowerCase().includes(keyword.toLowerCase()) ||
            doc.title.toLowerCase().includes(keyword.toLowerCase()),
        ),
    )

    return { relevantDocs, frameworks: object.relevantFrameworks }
  } catch (error) {
    console.error("[v0] Error in AI retrieval, falling back to keyword search:", error)

    // Simple keyword-based fallback
    const keywords = projectDescription.toLowerCase()
    const relevantDocs = COMPLIANCE_KNOWLEDGE_BASE.filter(
      (doc) =>
        keywords.includes(doc.framework.toLowerCase()) ||
        keywords.includes("data") ||
        keywords.includes("security") ||
        keywords.includes("user"),
    )

    return {
      relevantDocs: relevantDocs.length > 0 ? relevantDocs : COMPLIANCE_KNOWLEDGE_BASE.slice(0, 4),
      frameworks: ["General Security", "Data Protection"],
    }
  }
}

function detectCriticalViolations(projectTitle: string, projectDescription: string) {
  const fullText = `${projectTitle} ${projectDescription}`.toLowerCase()
  const detectedViolations = []

  for (const rule of CRITICAL_VIOLATIONS) {
    let matches = false

    if (rule.secondaryCheck) {
      // Use secondary check function for complex logic
      matches = rule.secondaryCheck(fullText)
    } else {
      // Use keyword matching
      matches = rule.matchAll
        ? rule.keywords.every((keyword) => fullText.includes(keyword.toLowerCase()))
        : rule.keywords.some((keyword) => fullText.includes(keyword.toLowerCase()))
    }

    if (matches) {
      detectedViolations.push(rule.violation)
    }
  }

  return detectedViolations
}

// Auto-detect compliance requirements
const AUTO_COMPLIANCE_PATTERNS = [
  {
    keywords: [
      "authentication",
      "login",
      "signup",
      "sign up",
      "user account",
      "register",
      "employee",
      "staff",
      "admin",
      "access control",
    ],
    requirements: [
      {
        type: "authentication",
        title: "Secure Authentication System",
        specs: [
          "Password hashing with bcrypt (min cost factor 12)",
          "Session management with HTTP-only cookies",
          "CSRF protection tokens",
          "Rate limiting on login attempts (max 5 per 15 minutes)",
          "Password complexity requirements (min 12 characters)",
          "Multi-factor authentication option",
          "Account lockout after failed attempts",
          "Secure password reset flow with time-limited tokens",
        ],
        frameworks: ["OWASP", "SOC 2"],
      },
    ],
  },
  {
    keywords: [
      "stripe",
      "payment",
      "billing",
      "subscription",
      "checkout",
      "purchase",
      "credit card",
      "card",
      "transaction",
      "charge",
      "invoice",
      "register",
      "pos",
      "point of sale",
    ],
    requirements: [
      {
        type: "payments",
        title: "PCI DSS Compliant Payment Processing",
        specs: [
          "Stripe or similar PCI DSS Level 1 certified payment processor integration",
          "Never store full credit card numbers on servers",
          "Use secure payment tokenization (Stripe Elements, PayPal SDK, etc.)",
          "Implement webhook verification for payment events",
          "SSL/TLS encryption for all payment pages and API calls",
          "PCI DSS compliance via certified payment processor",
          "Secure storage of customer IDs and payment method tokens only",
          "Audit logging for all payment transactions",
          "Do NOT store CVV, magnetic stripe data, or PIN data after authorization",
        ],
        frameworks: ["PCI DSS", "Payment Security"],
      },
    ],
  },
  {
    keywords: [
      "user data",
      "personal data",
      "email",
      "profile",
      "users table",
      "user_id",
      "registration",
      "collect",
      "customer",
      "employee",
      "contact",
      "address",
      "phone",
      "name",
    ],
    requirements: [
      {
        type: "gdpr_consent",
        title: "GDPR Consent & Data Protection",
        specs: [
          "Consent checkbox (unticked by default) on registration/signup forms with clear opt-in language",
          "Privacy policy page with detailed data usage disclosure",
          "Cookie consent banner with granular accept/reject options",
          "Terms of service with data processing agreement",
          "Consent tracking: Store consent timestamp, version, and IP in database",
          "Right to access: API endpoint for users to download all their data (JSON format)",
          "Right to deletion: Delete account functionality removing all personal data",
          "Right to rectification: User profile editing for all personal information",
          "Data portability: Export user data in machine-readable format",
          "Data retention policy: Auto-delete inactive accounts after 3 years with notification",
          "Breach notification procedures: Alert users within 72 hours of data breach",
          "Data processing records: Audit log of all data access and modifications",
          "Third-party vendor compliance: Ensure all integrations are GDPR compliant",
          "Data minimization: Only collect data absolutely necessary for service",
        ],
        frameworks: ["GDPR", "CCPA"],
      },
    ],
  },
  {
    keywords: ["encrypted", "_enc", "varbinary", "pii", "personal", "sensitive", "ssn", "social security"],
    requirements: [
      {
        type: "data_encryption",
        title: "Data Encryption & Security",
        specs: [
          "AES-256 encryption for all PII data at rest",
          "Encryption key management using environment variables (not in code)",
          "Key rotation policy every 90 days",
          "TLS 1.3 for all data in transit",
          "Encrypted database backups",
          "Secure key storage using secrets manager (AWS KMS, Azure Key Vault, etc.)",
          "Column-level encryption for sensitive fields (email, SSN, financial data)",
          "Encrypted session tokens with HTTP-only and Secure flags",
        ],
        frameworks: ["GDPR", "HIPAA", "SOC 2"],
      },
    ],
  },
  {
    keywords: ["mfa", "financial", "admin", "manager", "privileged", "supervisor"],
    requirements: [
      {
        type: "mfa_security",
        title: "Multi-Factor Authentication",
        specs: [
          "TOTP-based MFA (Google Authenticator, Authy compatible)",
          "Backup codes generation (10 one-time use codes)",
          "SMS fallback option for account recovery",
          "Mandatory MFA for admin/privileged accounts",
          "Optional MFA for regular users with strong encouragement",
          "MFA required for financial transactions above threshold ($500+)",
          "MFA setup wizard on first login for sensitive roles",
          "Recovery email verification before MFA bypass",
        ],
        frameworks: ["SOC 2", "NIST", "PCI DSS"],
      },
    ],
  },
  {
    keywords: ["tax", "1099", "vat", "irs", "tax_id", "ein", "financial reporting", "w-9", "w9"],
    requirements: [
      {
        type: "tax_compliance",
        title: "Tax & Financial Reporting Compliance",
        specs: [
          "Encrypted storage of Tax IDs (EIN/SSN) with field-level encryption",
          "1099 form generation for contractors earning $600+",
          "VAT/GST calculation and reporting for international transactions",
          "Tax jurisdiction detection based on user location",
          "Quarterly tax report generation",
          "Audit trail for all financial transactions",
          "W-9 form collection and storage",
          "Automated tax filing integration (optional via TaxJar/Avalara)",
          "Compliance with IRS e-file requirements",
        ],
        frameworks: ["IRS Regulations", "International Tax Law"],
      },
    ],
  },
  {
    keywords: [
      "database",
      "postgres",
      "mysql",
      "mongodb",
      "sql",
      "crud",
      "query",
      "insert",
      "update",
      "delete",
      "select",
      "inventory",
      "store",
    ],
    requirements: [
      {
        type: "database_security",
        title: "Database Security & SQL Injection Prevention",
        specs: [
          "Parameterized queries (prepared statements) - NEVER concatenate user input into SQL",
          "Use ORM with built-in SQL injection protection (Prisma, Sequelize, TypeORM)",
          "Database connection pooling with limits",
          "Encrypted connections to database (SSL/TLS)",
          "Row-level security policies where applicable",
          "Regular automated backups with encryption",
          "Database access audit logging",
          "Principle of least privilege for DB users",
          "Encryption at rest for sensitive columns",
          "Input validation and sanitization before database operations",
        ],
        frameworks: ["OWASP", "SOC 2"],
      },
    ],
  },
  {
    keywords: ["api", "endpoint", "rest", "graphql", "webhook", "integration"],
    requirements: [
      {
        type: "api_security",
        title: "API Security Standards",
        specs: [
          "JWT or session-based authentication",
          "Rate limiting per IP/user (e.g., 100 req/min)",
          "Input validation and sanitization",
          "CORS configuration with allowed origins",
          "API versioning strategy",
          "Error handling without exposing internals",
          "Request/response logging for audit",
          "API documentation with security notes",
        ],
        frameworks: ["OWASP", "REST Security"],
      },
    ],
  },
  {
    keywords: ["file upload", "image upload", "document upload", "attachment", "photo", "scan", "barcode"],
    requirements: [
      {
        type: "file_upload",
        title: "Secure File Upload Handling",
        specs: [
          "File type validation (whitelist allowed extensions)",
          "File size limits (e.g., 10MB max)",
          "Virus/malware scanning on upload",
          "Unique filename generation (prevent overwrites)",
          "Storage in secure location (not web root)",
          "Content-type verification",
          "Image sanitization (strip EXIF data)",
          "Access control for uploaded files",
        ],
        frameworks: ["OWASP", "Security Best Practices"],
      },
    ],
  },
  {
    keywords: ["employee", "staff", "worker", "contractor", "hr", "payroll", "time clock", "schedule", "shift"],
    requirements: [
      {
        type: "employee_data",
        title: "Employee Data Protection & Labor Compliance",
        specs: [
          "Encrypted storage of employee PII (SSN, address, contact info)",
          "Role-based access control for HR data",
          "Time tracking audit logs (cannot be modified without admin approval)",
          "Labor law compliance (FLSA overtime rules, break requirements)",
          "Employee data retention policy (7 years for tax/legal purposes)",
          "Access controls limiting who can view salary/compensation data",
          "Employee consent for data collection and processing",
          "Secure onboarding/offboarding procedures",
        ],
        frameworks: ["GDPR", "FLSA", "Labor Law"],
      },
    ],
  },
]

// Agentic compliance analyzer
export async function analyzeCompliance(projectTitle: string, projectDescription: string) {
  console.log("[v0] Starting compliance analysis...")

  const autoRequirements = detectAutoComplianceRequirements(projectTitle, projectDescription)
  console.log("[v0] Auto-detected requirements:", autoRequirements.length)

  const criticalViolations = detectCriticalViolations(projectTitle, projectDescription)
  console.log("[v0] Critical violations detected:", criticalViolations.length)

  const blockingViolations = criticalViolations.filter((v) => v.blockGeneration)
  if (blockingViolations.length > 0) {
    console.log("[v0] BLOCKING violations found - stopping generation")
    return {
      overallCompliance: "blocking-violations" as const,
      violations: blockingViolations,
      suggestions: [],
      summary:
        "CRITICAL COMPLIANCE VIOLATIONS DETECTED: Your project description contains practices that violate federal regulations. Review the violations below before proceeding. Generation has been blocked for your protection.",
      analyzedFrameworks: blockingViolations.map((v) => v.framework),
      autoComplianceSpecs: [],
    }
  }

  if (autoRequirements.length > 0) {
    console.log("[v0] Auto-requirements detected - marking as compliant and proceeding to generation")
    const frameworksList = [...new Set(autoRequirements.flatMap((req) => req.frameworks))]

    return {
      overallCompliance: "compliant" as const,
      violations: [],
      suggestions: [],
      summary: `✓ Compliance requirements auto-detected and will be built into specifications. Detected: ${autoRequirements.map((r) => r.title).join(", ")}. All ${frameworksList.join(", ")} requirements will be included automatically in the generated specifications.`,
      analyzedFrameworks: frameworksList,
      autoComplianceSpecs: autoRequirements,
      clarificationQuestions: [],
    }
  }

  try {
    // Step 1: Retrieve relevant compliance documents (RAG)
    const { relevantDocs, frameworks } = await retrieveRelevantCompliance(projectDescription)
    console.log("[v0] Retrieved compliance docs:", relevantDocs.length)

    // Step 2: Use AI to analyze compliance with agentic reasoning
    const complianceContext = relevantDocs
      .map(
        (doc) =>
          `[${doc.id}] ${doc.framework} - ${doc.title}
Source: ${doc.source}
Severity: ${doc.severity}
Requirements: ${doc.content}`,
      )
      .join("\n\n")

    const { object } = await generateObject({
      model: "google/gemini-2.5-pro",
      schema: z.object({
        overallCompliance: z.enum(["compliant", "minor-issues", "blocking-violations"]),
        violations: z.array(
          z.object({
            code: z.string().describe("Compliance code like GDPR-001"),
            framework: z.string().describe("Compliance framework name"),
            title: z.string().describe("Violation title"),
            description: z.string().describe("Detailed description of the violation"),
            severity: z.enum(["high", "medium", "low"]),
            source: z.string().describe("Legal source reference"),
            coaching: z.string().describe("Specific coaching on how to fix this issue"),
            requiredActions: z.array(z.string()).describe("Step-by-step actions to resolve"),
          }),
        ),
        suggestions: z.array(
          z.object({
            code: z.string(),
            framework: z.string(),
            title: z.string(),
            description: z.string(),
            severity: z.enum(["low", "medium"]),
            source: z.string(),
            recommendation: z.string(),
            bestPractice: z.string(),
          }),
        ),
        summary: z.string().describe("Executive summary of compliance status"),
        additionalQuestions: z
          .array(
            z.object({
              question: z.string().describe("Question to ask user for clarification"),
              why: z.string().describe("Why this information is needed for compliance"),
              required: z.boolean().describe("Whether this is critical to proceed"),
            }),
          )
          .describe("Questions to ask user ONLY if absolutely necessary for compliance - keep to minimum"),
      }),
      prompt: `You are an expert compliance automation system. Your PRIMARY goal is to AUTO-GENERATE complete compliance specifications, NOT to ask questions or block users.

Project Title: ${projectTitle}
Project Description: ${projectDescription}

Auto-Detected Compliance Requirements (WILL BE INCLUDED AUTOMATICALLY):
${autoRequirements.map((req) => `✓ ${req.title} (${req.frameworks.join(", ")})\n  ${req.specs.length} specifications`).join("\n")}

Relevant Compliance Knowledge Base:
${complianceContext}

CRITICAL OPERATING PRINCIPLES:

1. **NEVER ASK QUESTIONS** - Auto-generate everything based on detected patterns
   - User mentions "email" → Auto-include GDPR consent, privacy policy, data export
   - User mentions "Stripe" → Auto-include PCI DSS, webhook verification, secure tokens
   - User mentions "authentication" → Auto-include bcrypt, session management, rate limiting
   - User mentions "health/medical" → Auto-include HIPAA encryption, audit logs, BAAs
   - User has encrypted fields → Auto-include encryption at rest/transit specs

2. **ONLY BLOCK FOR TRULY ILLEGAL PRACTICES:**
   - Sending credit cards through plain email/SMS (NOT through payment processor)
   - Claiming to provide medical diagnoses without FDA approval
   - Storing passwords in plaintext
   - Explicitly illegal activities

3. **AUTO-GENERATE, DON'T ASK:**
   - If they collect email → Add consent checkbox spec automatically
   - If they have billing → Add privacy policy spec automatically
   - If they have users → Add data export/deletion specs automatically
   - If they mention security → Add encryption specs automatically

4. **DEFAULT TO "COMPLIANT" STATUS:**
   - Return "compliant" when all necessary specs are auto-generated
   - Only return "minor-issues" if there's a best practice they might want to add (but not required)
   - Only return "blocking-violations" for truly illegal practices

5. **VIOLATIONS SHOULD BE RARE:**
   - The auto-detected requirements cover 99% of cases
   - Only flag a violation if it's something we CAN'T auto-generate (like changing illegal behavior)
   - Focus on GENERATING solutions, not LISTING problems

Your response should contain:
- overallCompliance: "compliant" (we auto-generated everything needed)
- violations: [] (empty array unless truly illegal practice detected)
- suggestions: [optional nice-to-have improvements]
- summary: "All compliance requirements auto-generated. Ready to create specification."
- additionalQuestions: [] (empty - we never ask questions)

Analyze and AUTO-GENERATE specifications:`,
    })

    console.log("[v0] Analysis complete:", object.overallCompliance)

    const allViolations = [...criticalViolations, ...object.violations]

    return {
      overallCompliance: allViolations.length > 0 ? object.overallCompliance : ("compliant" as const),
      violations: allViolations,
      suggestions: object.suggestions,
      summary: object.summary,
      analyzedFrameworks: frameworks,
      autoComplianceSpecs: autoRequirements, // Pass through for spec generation
      clarificationQuestions: object.additionalQuestions || [],
    }
  } catch (error) {
    console.error("[v0] Error in compliance analysis:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.message : String(error))

    if (criticalViolations.length > 0) {
      return {
        overallCompliance: "blocking-violations" as const,
        violations: criticalViolations,
        suggestions: [],
        summary:
          "CRITICAL COMPLIANCE VIOLATIONS DETECTED: AI analysis failed, but keyword detection found serious regulatory violations. Review the violations below before proceeding.",
        analyzedFrameworks: criticalViolations.map((v) => v.framework),
        autoComplianceSpecs: [],
        clarificationQuestions: [],
      }
    }

    return {
      overallCompliance: "minor-issues" as const,
      violations: [],
      suggestions: [
        {
          code: "GENERAL-001",
          framework: "General Security",
          title: "Security Review Recommended",
          description: "The compliance analysis system encountered an error. A manual security review is recommended.",
          severity: "medium" as const,
          source: "Best Practice",
          recommendation: "Please review your project for data protection, authentication, and security requirements.",
          bestPractice:
            "Consider GDPR for data handling, OWASP for security vulnerabilities, and SOC 2 for access controls.",
        },
      ],
      summary:
        "Compliance analysis is currently unavailable. Please proceed with caution and consider a manual compliance review.",
      analyzedFrameworks: ["General"],
      autoComplianceSpecs: autoRequirements, // Still include auto-detected specs even if AI fails
      clarificationQuestions: [],
    }
  }
}

// Generate coaching response for violations
export async function generateCoaching(violation: {
  code: string
  title: string
  description: string
  severity: string
}) {
  const { text } = await generateText({
    model: "google/gemini-2.5-pro",
    prompt: `You are a compliance coach. Provide detailed, supportive guidance for this violation:

Code: ${violation.code}
Title: ${violation.title}
Description: ${violation.description}
Severity: ${violation.severity}

Provide:
1. Why this matters (business and legal impact)
2. Step-by-step guidance to fix it
3. Examples of compliant implementations
4. Common mistakes to avoid

Keep it practical, clear, and encouraging.`,
    maxOutputTokens: 1000,
  })

  return text
}
