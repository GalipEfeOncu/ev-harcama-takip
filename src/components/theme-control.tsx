import Link from "next/link";
import { Settings } from "lucide-react";

// Public and onboarding screens share the same appearance preferences page.
export default function ThemeControl({ full = false }: { full?: boolean }) {
  return (
    <Link className={`settings-entry${full ? " settings-entry--full" : " settings-entry--icon"}`} href="/settings" aria-label="Ayarlar" title="Ayarlar">
      <Settings aria-hidden="true" size={19} />
      {full && <span>Ayarlar</span>}
    </Link>
  );
}
