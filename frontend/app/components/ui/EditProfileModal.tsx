"use client";

import React, { useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { tokenStorage } from "@/lib/tokenStorage";

interface EditProfileModalProps {
  onClose: () => void;
}

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;

export default function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.profile_image ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const nicknameValid =
    nickname.trim().length >= NICKNAME_MIN && nickname.trim().length <= NICKNAME_MAX;

  const handleSave = async () => {
    if (!nicknameValid) {
      setError(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let profileImageUrl = user?.profile_image ?? null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/post/profile-image`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}` },
            body: formData,
          },
        );

        if (!uploadRes.ok) {
          throw new Error("이미지 업로드에 실패했습니다.");
        }
        const uploadData = await uploadRes.json();
        profileImageUrl = uploadData.profile_image;
      }

      const updateRes = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_API_URL}/users/put/me`,
        {
          method: "PUT",
          body: JSON.stringify({
            nickname: nickname.trim(),
            profile_image: profileImageUrl,
          }),
        },
      );

      if (!updateRes.ok) {
        throw new Error("프로필 저장에 실패했습니다.");
      }

      const updatedUser = await updateRes.json();
      setUser(updatedUser);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <div className="relative w-full sm:mx-6 bg-white rounded-t-3xl sm:rounded-3xl px-6 pt-8 pb-10 shadow-2xl animate-slide-up">
        <h3 className="text-[17px] font-bold text-slate-900 text-center mb-6">프로필 수정</h3>

        {/* Profile Photo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="프로필 미리보기"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-md active:scale-95 transition-transform"
              aria-label="프로필 사진 변경"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Nickname */}
        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 mb-1.5 block">닉네임</label>
          <div className="relative">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, NICKNAME_MAX))}
              maxLength={NICKNAME_MAX}
              className="w-full py-3 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              placeholder="닉네임을 입력해주세요"
            />
            {nickname && (
              <button
                type="button"
                onClick={() => setNickname("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                aria-label="닉네임 지우기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-1.5">
            {nickname.trim().length}/{NICKNAME_MAX}자 ({NICKNAME_MIN}~{NICKNAME_MAX}자)
          </p>
        </div>

        {/* Account Info (read-only) */}
        <div className="mb-6 p-4 bg-slate-50 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">이메일</span>
            <span className="text-xs font-bold text-slate-700">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">연동 계정</span>
            <span className="text-xs font-bold text-slate-700">구글 계정으로 연결됨</span>
          </div>
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-500 mb-3 text-center">{error}</p>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving || !nicknameValid}
          className="w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}
