import { useEffect, useState } from "react";
import { getAnnouncements, type Announcement } from "@/lib/admin-actions.functions";
import { useQuery } from "@tanstack/react-query";

import { X } from "lucide-react";

export function AnnouncementBar() {
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => getAnnouncements(),
    staleTime: 1000 * 60 * 5,
  });

  const [visible, setVisible] = useState(true);

  if (!visible || announcements.length === 0) return null;

  const current = announcements[0];
  if (!current) return null;

  return (
    <div className={`relative w-full py-2.5 px-4 text-center text-xs font-bold tracking-wide transition-colors ${
      current.type === 'warning' ? 'bg-warning text-warning-foreground' : 
      current.type === 'success' ? 'bg-success text-success-foreground' : 
      'bg-primary/20 text-primary border-b border-primary/20'
    }`}>
      <div className="mx-auto max-w-6xl pr-8">
        <span className="inline-block animate-pulse ml-2">📢</span>
        {current.content}
      </div>
      <button 
        onClick={() => setVisible(false)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-black/10 rounded-full transition-colors"
        aria-label="إغلاق التنويه"
      >
        <X className="size-3.5" />
      </button>
    </div>

  );
}

