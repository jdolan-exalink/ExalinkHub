import React from 'react';

export default function RecordingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full bg-black overflow-hidden">
      {children}
    </div>
  );
}