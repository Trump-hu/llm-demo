/**
 * 中国大陆 身份证 / 固定电话 / 手机号码 校验
 *
 * 纯函数、零依赖，浏览器与 Node.js 均可直接使用。
 * 身份证除正则外还校验出生日期是否真实存在、第 18 位校验码是否正确。
 */

/* ------------------------------------------------------------------ */
/* 身份证                                                              */
/* ------------------------------------------------------------------ */

/** 18 位身份证：6 位地址码 + 8 位出生日期 + 3 位顺序码 + 1 位校验码 */
const ID_CARD_18_RE =
  /^[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;

/** 15 位老式身份证：6 位地址码 + 6 位出生日期（YYMMDD）+ 3 位顺序码 */
const ID_CARD_15_RE =
  /^[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}$/;

/** 加权因子：身份证前 17 位分别乘以对应权重后求和 */
const ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;

/** 校验码表：加权和模 11 的结果映射为第 18 位字符 */
const ID_CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

/** 判断年月日是否为真实存在的日期（排除 2 月 30 日、4 月 31 日等） */
function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > new Date().getFullYear()) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** 校验 18 位身份证的日期与校验码 */
function isValid18(value: string): boolean {
  if (!ID_CARD_18_RE.test(value)) return false;

  const year = Number(value.slice(6, 10));
  const month = Number(value.slice(10, 12));
  const day = Number(value.slice(12, 14));
  if (!isRealDate(year, month, day)) return false;

  const sum = ID_WEIGHTS.reduce(
    (acc, weight, index) => acc + weight * Number(value[index]),
    0,
  );
  return value[17].toUpperCase() === ID_CHECK_CODES[sum % 11];
}

/** 校验 15 位老式身份证（无校验码，只校验格式与日期） */
function isValid15(value: string): boolean {
  if (!ID_CARD_15_RE.test(value)) return false;

  const year = 1900 + Number(value.slice(6, 8));
  const month = Number(value.slice(8, 10));
  const day = Number(value.slice(10, 12));
  return isRealDate(year, month, day);
}

/**
 * 校验居民身份证号码（支持 18 位与 15 位）。
 *
 * @example
 * isValidIdCard('11010519491231002X'); // true
 * isValidIdCard('110105194912310012'); // false（校验码错误）
 * isValidIdCard('11010519490230002X'); // false（2 月 30 日不存在）
 */
export function isValidIdCard(idCard: string): boolean {
  if (typeof idCard !== 'string') return false;
  const value = idCard.trim();
  if (value.length === 18) return isValid18(value);
  if (value.length === 15) return isValid15(value);
  return false;
}

/* ------------------------------------------------------------------ */
/* 电话号码                                                            */
/* ------------------------------------------------------------------ */

/**
 * 去掉空白、括号、连字符以及 +86 / 86 国家码，便于统一校验。
 * 例：'+86 138-0013-8000' -> '13800138000'
 */
function normalize(value: string): string {
  return value.replace(/[\s()\-]/g, '').replace(/^\+?86/, '');
}

/**
 * 固定电话：区号（0 开头，3~4 位）+ 7~8 位号码 + 可选分机号。
 * 区号与号码之间、号码与分机号之间可以用 - 或空格分隔，也可以直接连写。
 *
 * @example
 * isValidLandline('010-62345678');    // true
 * isValidLandline('057188888888');    // true
 * isValidLandline('010-62345678-123'); // true（分机 123）
 */
const LANDLINE_RE = /^0\d{2,3}[-\s]?[2-9]\d{6,7}(?:[-\s]\d{1,6})?$/;

/**
 * 校验固定电话号码（座机）。
 *
 * @example
 * isValidLandline('010-62345678'); // true
 * isValidLandline('13800138000');  // false（这是手机号）
 */
export function isValidLandline(phone: string): boolean {
  if (typeof phone !== 'string') return false;
  return LANDLINE_RE.test(phone.trim());
}

/* ------------------------------------------------------------------ */
/* 手机号码                                                            */
/* ------------------------------------------------------------------ */

/** 中国大陆手机号：1 开头，第二位 3~9，共 11 位 */
const MOBILE_RE = /^1[3-9]\d{9}$/;

/**
 * 校验中国大陆手机号码。
 * 允许空格、连字符分隔以及 +86 / 86 前缀。
 *
 * @example
 * isValidMobile('13800138000');       // true
 * isValidMobile('+86 138 0013 8000'); // true
 * isValidMobile('12345678901');       // false
 */
export function isValidMobile(mobile: string): boolean {
  if (typeof mobile !== 'string') return false;
  return MOBILE_RE.test(normalize(mobile));
}

/* ------------------------------------------------------------------ */
/* 综合                                                                */
/* ------------------------------------------------------------------ */

/**
 * 校验电话号码：手机号或固定电话，满足其一即通过。
 *
 * @example
 * isValidPhone('13800138000');  // true
 * isValidPhone('010-62345678'); // true
 * isValidPhone('10086');        // false
 */
export function isValidPhone(phone: string): boolean {
  return isValidMobile(phone) || isValidLandline(phone);
}