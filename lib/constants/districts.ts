import type { AissaDistrictCode } from "../aissa-id";

export const SRI_LANKAN_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
] as const;

export type District = (typeof SRI_LANKAN_DISTRICTS)[number];

export const DISTRICT_TO_AISSA_MAP: Record<District, AissaDistrictCode> = {
  Colombo: "AWC",
  Gampaha: "AWG",
  Kalutara: "AWK",
  Kandy: "AC",
  Matale: "AC",
  "Nuwara Eliya": "AC",
  Galle: "AS",
  Matara: "AS",
  Hambantota: "AS",
  Jaffna: "ANE",
  Kilinochchi: "ANE",
  Mannar: "ANE",
  Vavuniya: "ANE",
  Mullaitivu: "ANE",
  Batticaloa: "ANE",
  Ampara: "ANE",
  Trincomalee: "ANE",
  Kurunegala: "ANCW",
  Puttalam: "ANCW",
  Anuradhapura: "ANCW",
  Polonnaruwa: "ANCW",
  Badulla: "AUS",
  Monaragala: "AUS",
  Ratnapura: "AUS",
  Kegalle: "AUS",
};

export function isDistrict(value: string): value is District {
  return SRI_LANKAN_DISTRICTS.some((district) => district === value);
}

export function getAissaDistrict(district: string): AissaDistrictCode | "" {
  return isDistrict(district) ? DISTRICT_TO_AISSA_MAP[district] : "";
}
