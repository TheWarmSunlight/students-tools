export type NumericCompareResult = {
  equivalent: boolean;
  reason?: "格式无法识别";
};

type OperatorToken = "+" | "-" | "*" | "/" | "(" | ")" | "%";

type Rational = {
  numerator: bigint;
  denominator: bigint;
};

type Token =
  | { type: "number"; value: Rational }
  | { type: "operator"; value: OperatorToken };

const MAX_INPUT_LENGTH = 80;

export function numericEquivalent(student: string, expected: string): NumericCompareResult {
  const studentValue = evaluate(student);
  const expectedValue = evaluate(expected);

  if (studentValue === null || expectedValue === null) {
    return invalidResult();
  }

  return {
    equivalent:
      studentValue.numerator === expectedValue.numerator &&
      studentValue.denominator === expectedValue.denominator,
  };
}

function invalidResult(): NumericCompareResult {
  return {
    equivalent: false,
    reason: "格式无法识别",
  };
}

function evaluate(input: string): Rational | null {
  if (input.length > MAX_INPUT_LENGTH || input.trim() === "") {
    return null;
  }

  try {
    const parser = new Parser(tokenize(input));
    return parser.parse();
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

  const value = parseNumberLiteral(input.slice(start, position));

  return {
    token: { type: "number", value } satisfies Token,
    nextPosition: position,
  };
}

function isDigit(char: string) {
  return char >= "0" && char <= "9";
}

function parseNumberLiteral(literal: string): Rational {
  const [integerPartRaw, fractionalPartRaw] = literal.split(".");
  const integerPart = integerPartRaw === "" ? "0" : integerPartRaw;
  const fractionalPart = fractionalPartRaw ?? "";
  const digits = `${integerPart}${fractionalPart}`;
  const denominator = 10n ** BigInt(fractionalPart.length);

  return rational(BigInt(digits), denominator);
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (denominator === 0n) {
    throw new Error("Division by zero");
  }

  if (numerator === 0n) {
    return { numerator: 0n, denominator: 1n };
  }

  const sign = denominator < 0n ? -1n : 1n;
  const normalizedNumerator = numerator * sign;
  const normalizedDenominator = denominator * sign;
  const divisor = gcd(normalizedNumerator, normalizedDenominator);

  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  };
}

function gcd(left: bigint, right: bigint) {
  let a = abs(left);
  let b = abs(right);

  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a;
}

function abs(value: bigint) {
  return value < 0n ? -value : value;
}

function add(left: Rational, right: Rational) {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Rational, right: Rational) {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Rational, right: Rational) {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Rational, right: Rational) {
  return rational(left.numerator * right.denominator, left.denominator * right.numerator);
}

function negate(value: Rational) {
  return rational(-value.numerator, value.denominator);
}

function percent(value: Rational) {
  return rational(value.numerator, value.denominator * 100n);
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

  private expression(): Rational {
    let value = this.term();

    while (this.match("+") || this.match("-")) {
      const operator = this.previous().value;
      const right = this.term();
      value = operator === "+" ? add(value, right) : subtract(value, right);
    }

    return value;
  }

  private term(): Rational {
    let value = this.factor();

    while (this.match("*") || this.match("/")) {
      const operator = this.previous().value;
      const right = this.factor();
      value = operator === "*" ? multiply(value, right) : divide(value, right);
    }

    return value;
  }

  private factor(): Rational {
    let value = this.unary();

    while (this.match("%")) {
      value = percent(value);
    }

    return value;
  }

  private unary(): Rational {
    if (this.match("+")) {
      return this.unary();
    }

    if (this.match("-")) {
      return negate(this.unary());
    }

    return this.primary();
  }

  private primary(): Rational {
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
