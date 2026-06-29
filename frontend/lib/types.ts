export interface User {
  id: string
  email: string
  nickname: string | null
  profile_image: string | null
  created_at: string
  survey_completed: boolean
}

export interface FilterState {
  city: string
  district: string
  employment: string
  categories: Record<string, boolean>
  keywords?: string[]
  age?: number
}
