import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your assistant
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Settings className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h2 className="mb-1 text-lg font-medium">Settings coming soon</h2>
          <p className="text-sm text-muted-foreground">
            Preferences, notifications, and integrations
          </p>
        </div>
      </div>
    </div>
  );
}
