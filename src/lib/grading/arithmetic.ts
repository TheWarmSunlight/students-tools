export type NumericCompareResult = {
  equivalent: boolean;
  reason?: "格式无法识别";
};

type OperatorToken = "+" | "-" | "*" | "/" | "(" | ")" | "%";

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: OperatorToken };

const INVALID_RESULT: NumericCompareResult = {
  equivalent: false,
  reason: "格式无法识别",
};

const MAX_INPUT_LENGTH = 80;
const TOLERANCE = 1e-9;

export function numericEquivalent(student: string, expected: string): NumericCompareResult {
  const studentValue = evaluate(student);
  const expectedValue = evaluate(expected);

  if (studentValue === null || expectedValue === null) {
    return INVALID_RESULT;
  }

  return {
    equivalent: Math.abs(studentValue - expectedValue) <= TOLERANCE,
  };
}

function evaluate(input: string): number | null {
  if (input.length > MAX_INPUT_LENGTH || input.trim() === "") {
    return null;
  }

  try {
    const parser = new Parser(tokenize(input));
    const value = parser.parse();
    assertRecognizedNumericValue(value);
    return value;
  } catch {
    return null;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    const char = input[position];

    if (/\s/.test(char)) {
      position += 1;
      continue;
    }

    if (isDigit(char) || char === ".") {
      const { token, nextPosition } = readNumber(input, position);
      tokens.push(token);
      position = nextPosition;
      continue;
    }

    if (char === "+" || char === "-" || char === "(" || char === ")" || char === "%") {
      tokens.push({ type: "operator", value: char });
      position += 1;
      continue;
    }

    if (char === "*" || char === "×" || char === "x") {
      tokens.push({ type: "operator", value: "*" });
      position += 1;
      continue;
    }

    if (char === "/" || char === "÷") {
      tokens.push({ type: "operator", value: "/" });
      position += 1;
      continue;
    }

    throw new Error("Unsupported character");
  }

  return tokens;
}

function readNumber(input: string, start: number) {
  let position = start;
  let hasDot = false;
  let hasDigit = false;

  while (position < input.length) {
    const char = input[position];

    if (isDigit(char)) {
      hasDigit = true;
      position += 1;
      continue;
    }

    if (char === ".") {
      if (hasDot) {
        throw new Error("Malformed number");
      }
      hasDot = true;
      position += 1;
      continue;
    }

    break;
  }

  if (!hasDigit) {
    throw new Error("Malformed number");
  }

  const value = Number(input.slice(start, position));
  assertRecognizedNumericValue(value);

  return {
    token: { type: "number", value } satisfies Token,
    nextPosition: position,
  };
}

function isDigit(char: string) {
  return char >= "0" && char <= "9";
}

function assertRecognizedNumericValue(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new Error("Unsafe numeric value");
  }
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse() {
    const value = this.expression();
    if (this.position !== this.tokens.length) {
      throw new Error("Unexpected token");
    }
    return value;
  }

  private expression(): number {
    let value = this.term();

    while (this.match("+") || this.match("-")) {
      const operator = this.previous().value;
      const right = this.term();
      value = operator === "+" ? value + right : value - right;
      assertRecognizedNumericValue(value);
    }

    return value;
  }

  private term(): number {
    let value = this.factor();

    while (this.match("*") || this.match("/")) {
      const operator = this.previous().value;
      const right = this.factor();

      if (operator === "/" && right === 0) {
        throw new Error("Division by zero");
      }

      value = operator === "*" ? value * right : value / right;
      assertRecognizedNumericValue(value);
    }

    return value;
  }

  private factor(): number {
    let value = this.unary();

    while (this.match("%")) {
      value /= 100;
      assertRecognizedNumericValue(value);
    }

    return value;
  }

  private unary(): number {
    if (this.match("+")) {
      return this.unary();
    }

    if (this.match("-")) {
      const value = -this.unary();
      assertRecognizedNumericValue(value);
      return value;
    }

    return this.primary();
  }

  private primary(): number {
    const token = this.advance();

    if (token.type === "number") {
      return token.value;
    }

    if (token.value === "(") {
      const value = this.expression();
      if (!this.match(")")) {
        throw new Error("Missing closing parenthesis");
      }
      return value;
    }

    throw new Error("Expected number or parenthesized expression");
  }

  private match(value: OperatorToken) {
    if (!this.check(value)) {
      return false;
    }
    this.position += 1;
    return true;
  }

  private check(value: OperatorToken) {
    const token = this.peek();
    return token?.type === "operator" && token.value === value;
  }

  private advance() {
    if (this.position >= this.tokens.length) {
      throw new Error("Unexpected end of expression");
    }

    const token = this.tokens[this.position];
    this.position += 1;
    return token;
  }

  private previous() {
    return this.tokens[this.position - 1];
  }

  private peek() {
    return this.tokens[this.position];
  }
}
