"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";

type Props = {
  /** Adjust icon size. Defaults to `size-5`. */
  iconClassName?: string;
  /** Optional wrapper class for the button element. */
  buttonClassName?: string;
  /** Route to settings page. Defaults to role portal settings path. */
  href?: string;
};

export default function SettingsIconLink({
  iconClassName = "size-5",
  buttonClassName,
  href: hrefProp,
}: Props) {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const href = hrefProp ?? paths.settings;
  return (
    <Button
      asChild
      type="button"
      size="icon"
      variant="ghost"
      className={cn("rounded-full", buttonClassName)}
      aria-label="Settings"
    >
      <Link href={href}>
        <Settings className={iconClassName} />
      </Link>
    </Button>
  );
}
