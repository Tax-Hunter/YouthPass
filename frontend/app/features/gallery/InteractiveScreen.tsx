"use client";

import React from "react";
import LoginScreen from "../auth/LoginScreen";
import HomeScreen from "../home/HomeScreen";
import LocationScreen from "../location/LocationScreen";
import PolicyListScreen from "../policy/PolicyListScreen";
import PolicyListV2Screen from "../policy/PolicyListV2Screen";
import PolicyDetailScreen from "../policy/PolicyDetailScreen";
import BookmarkedScreen from "../bookmarks/BookmarkedScreen";
import SearchScreen from "../search/SearchScreen";
import FilterScreen from "../filter/FilterScreen";
import MyPageScreen from "../mypage/MyPageScreen";
import ProfileScreen from "../auth/ProfileScreen";
import Error404Screen from "../errors/Error404Screen";

interface Props {
  screenId: string;
  onNavigate?: (screenId: string) => void;
}

export default function InteractiveScreen({ screenId, onNavigate }: Props) {
  // Extract route name without parameters for matching
  const route = screenId.split("?")[0];

  switch (route) {
    case "login":
      return <LoginScreen onNavigate={onNavigate} />;
    case "home":
    case "":
      return <HomeScreen onNavigate={onNavigate} />;
    case "location":
      return <LocationScreen onNavigate={onNavigate} />;
    case "policy-list":
    case "list":
      return <PolicyListScreen onNavigate={onNavigate} />;
    case "policy-list-v2":
    case "skeleton":
      return <PolicyListV2Screen onNavigate={onNavigate} />;
    case "policy-detail":
    case "detail":
      return <PolicyDetailScreen onNavigate={onNavigate} />;
    case "bookmarked":
    case "bookmarks":
      return <BookmarkedScreen onNavigate={onNavigate} />;
    case "search":
      return <SearchScreen onNavigate={onNavigate} />;
    case "filter":
      return <FilterScreen onNavigate={onNavigate} />;
    case "mypage":
      return <MyPageScreen onNavigate={onNavigate} />;
    case "profile":
      return <ProfileScreen onNavigate={onNavigate} />;
    case "404":
      return <Error404Screen onNavigate={onNavigate} />;
    default:
      return <Error404Screen onNavigate={onNavigate} />;
  }
}
