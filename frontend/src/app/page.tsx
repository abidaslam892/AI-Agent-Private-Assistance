"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { authStorage } from "@/lib/auth";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setIsLoadingAuth(false);

    setSelectedConversationId(searchParams.get("id"));
  }, [searchParams, router]);

  if (isLoadingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#171717] text-white">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span>Verifying private session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121]">
      <Sidebar
        currentConversationId={selectedConversationId}
        onSelectConversation={(id) => setSelectedConversationId(id)}
        onNewChat={() => {
          setSelectedConversationId(null);
          router.replace("/");
        }}
      />
      <main className="flex-1 h-full overflow-hidden">
        <ChatArea
          conversationId={selectedConversationId}
          onConversationCreated={(id) => {
            setSelectedConversationId(id);
            router.replace(`/?id=${id}`);
          }}
        />
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#171717] text-white">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
