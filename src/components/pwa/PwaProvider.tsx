import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "tikka.install-hint-dismissed";

export function PwaProvider() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIos && !standalone) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* تجاهل */
    }
  };

  if (dismissed) return null;
  if (!promptEvent && !showIosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 rounded-xl border border-border bg-surface p-3 shadow-lifted md:inset-x-auto md:start-4 md:bottom-4 md:w-80">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">ثبّت تِكّة على موبايلك</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {promptEvent
              ? "يفتح أسرع من المتصفح، وتلاقيه قدامك على طول."
              : "من قايمة المشاركة في سفاري، اختار «إضافة إلى الشاشة الرئيسية»."}
          </p>
          {promptEvent ? (
            <Button
              size="sm"
              className="mt-2"
              onClick={async () => {
                await promptEvent.prompt();
                await promptEvent.userChoice;
                close();
              }}
            >
              <Download className="size-4" />
              تثبيت
            </Button>
          ) : (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Share className="size-4" /> مشاركة ← إضافة إلى الشاشة الرئيسية
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="إخفاء تلميح التثبيت"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
