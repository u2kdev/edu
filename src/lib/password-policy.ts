/**
 * Unified Password Policy Module (Stage S2.5)
 * - Minimum 10 characters, maximum 128 characters
 * - Ban list of popular/common passwords
 * - Ban passwords containing/matching email, phone, full name, or username
 */

// Embedded list of top popular and easily guessable passwords
export const TOP_COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678901",
  "123456789012",
  "password1234",
  "password12345",
  "passwords123",
  "qwertyuiop",
  "qwertyuiop1",
  "asdfghjkl1",
  "zxcvbnm123",
  "admin12345",
  "administrator",
  "welcome1234",
  "welcome12345",
  "iloveyou123",
  "sunshine123",
  "princess123",
  "football123",
  "baseball123",
  "basketball1",
  "superman123",
  "batman12345",
  "master12345",
  "dragon12345",
  "monkey12345",
  "shadow12345",
  "mustang1234",
  "michael1234",
  "jessica1234",
  "charlie1234",
  "robert12345",
  "daniel12345",
  "thomas12345",
  "chelsea1234",
  "arsenal1234",
  "liverpool12",
  "barcelona12",
  "realmadrid1",
  "freedom1234",
  "trustno1123",
  "starwars123",
  "pokemon1234",
  "matrix12345",
  "letmein1234",
  "trustme1234",
  "default1234",
  "changeme123",
  "temporary12",
  "secret12345",
  "access12345",
  "login123456",
  "internet123",
  "computer123",
  "security123",
  "supersecret",
]);

export interface UserPasswordContext {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  username?: string | null;
}

export interface PasswordValidationResult {
  valid: boolean;
  errorKey?: string;
  message?: string;
}

export function validatePasswordPolicy(
  password: string,
  context?: UserPasswordContext
): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return {
      valid: false,
      errorKey: "auth.password.required",
      message: "Пароль обязателен для заполнения",
    };
  }

  // 1. Length check: min 10, max 128
  if (password.length < 10) {
    return {
      valid: false,
      errorKey: "auth.password.min_10",
      message: "Пароль должен содержать не менее 10 символов",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      errorKey: "auth.password.max_128",
      message: "Пароль не должен превышать 128 символов",
    };
  }

  const lowerPwd = password.toLowerCase();

  // 2. Common password check
  if (TOP_COMMON_PASSWORDS.has(lowerPwd)) {
    return {
      valid: false,
      errorKey: "auth.password.too_common",
      message: "Данный пароль слишком распространен. Выберите более надежный пароль",
    };
  }

  // 3. Check for personal context match (email, phone, name, username)
  if (context) {
    // Email check
    if (context.email) {
      const lowerEmail = context.email.trim().toLowerCase();
      if (lowerPwd === lowerEmail) {
        return {
          valid: false,
          errorKey: "auth.password.matchesEmail",
          message: "Пароль не должен совпадать с email",
        };
      }
      const localPart = lowerEmail.split("@")[0];
      if (localPart && localPart.length >= 3 && lowerPwd.includes(localPart)) {
        return {
          valid: false,
          errorKey: "auth.password.containsEmail",
          message: "Пароль не должен содержать имя учетной записи email",
        };
      }
    }

    // Phone check (digits only)
    if (context.phone) {
      const phoneDigits = context.phone.replace(/\D/g, "");
      if (phoneDigits.length >= 7 && lowerPwd.includes(phoneDigits)) {
        return {
          valid: false,
          errorKey: "auth.password.containsPhone",
          message: "Пароль не должен содержать номер телефона",
        };
      }
    }

    // Username check
    if (context.username) {
      const lowerUsername = context.username.trim().toLowerCase();
      if (lowerUsername.length >= 3 && lowerPwd.includes(lowerUsername)) {
        return {
          valid: false,
          errorKey: "auth.password.containsUsername",
          message: "Пароль не должен содержать имя пользователя",
        };
      }
    }

    // Full name check: individual words from name (e.g. "Иван Иванов")
    if (context.fullName) {
      const words = context.fullName
        .trim()
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length >= 3);

      for (const word of words) {
        if (lowerPwd.includes(word)) {
          return {
            valid: false,
            errorKey: "auth.password.containsName",
            message: "Пароль не должен содержать ваше имя или фамилию",
          };
        }
      }
    }
  }

  return { valid: true };
}
