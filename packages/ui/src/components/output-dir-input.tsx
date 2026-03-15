import * as React from 'react';
import { Input } from './ui/input.js';
import { Label } from './ui/label.js';
import { FolderOpen } from 'lucide-react';

interface OutputDirInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OutputDirInput({ value, onChange, disabled }: OutputDirInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <FolderOpen className="h-3.5 w-3.5" />
        Output Directory
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Leave empty for default"
        disabled={disabled}
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        Absolute path where generated images are saved
      </p>
    </div>
  );
}
