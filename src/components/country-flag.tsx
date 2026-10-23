import { useAppTranslations } from "@/i18n/shared";
import { countryFlagData } from "@/lib/country-flag";
export function CountryFlag({ code }: { code?: string | null }) {
  const tr = useAppTranslations();
  const country = countryFlagData(code, tr.locale);
  return country ? (
    <span
      className="country-flag"
      role="img"
      aria-label={tr("{value0} flag", { value0: country.name })}
      title={country.name}
    >
      {country.flag}
    </span>
  ) : null;
}
