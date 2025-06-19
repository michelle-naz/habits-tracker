'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Download, RefreshCw, Target, CheckCircle2, Circle, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import Auth from '@/components/Auth'

interface Habit {
  id: string
  name: string
  user_id: string
}



interface HabitTracker {
  [habitId: string]: {
    [day: string]: boolean
  }
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function HabitTracker() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnboarding, setIsOnboarding] = useState(true)
  const [habits, setHabits] = useState<Habit[]>([])
  const [tracker, setTracker] = useState<HabitTracker>({})
  const [weekStartDate, setWeekStartDate] = useState('')
  const [habitInputs, setHabitInputs] = useState(['', '', '', '', ''])

  const getCurrentWeekStart = () => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1))
    return monday.toISOString().split('T')[0]
  }

  const loadUserHabits = useCallback(async (userId: string) => {
    try {
      // Load habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (habitsError) throw habitsError

      if (habitsData && habitsData.length > 0) {
        setHabits(habitsData)
        setIsOnboarding(false)
        
        // Load habit entries for current week
        const weekStart = getCurrentWeekStart()
        setWeekStartDate(weekStart)
        await loadHabitEntries(habitsData, weekStart)
      } else {
        setIsOnboarding(true)
        setWeekStartDate(getCurrentWeekStart())
      }
    } catch (error) {
      console.error('Error loading habits:', error)
    }
  }, [])

  // Check auth state and load user data
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          await loadUserHabits(user.id)
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadUserHabits(session.user.id)
      } else {
        setHabits([])
        setTracker({})
        setIsOnboarding(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUserHabits])

  const loadHabitEntries = async (userHabits: Habit[], weekStart: string) => {
    try {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      const { data: entriesData, error } = await supabase
        .from('habit_entries')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', weekStart)
        .lte('date', weekEnd.toISOString().split('T')[0])

      if (error) throw error

      // Convert entries to tracker format
      const newTracker: HabitTracker = {}
      userHabits.forEach(habit => {
        newTracker[habit.id] = {}
        DAYS.forEach((_, dayIndex) => {
          const date = new Date(weekStart)
          date.setDate(date.getDate() + dayIndex)
          const dateStr = date.toISOString().split('T')[0]
          const dayName = DAYS[dayIndex]
          
          const entry = entriesData?.find(e => e.habit_id === habit.id && e.date === dateStr)
          newTracker[habit.id][dayName] = entry?.completed || false
        })
      })
      
      setTracker(newTracker)
    } catch (error) {
      console.error('Error loading habit entries:', error)
    }
  }

  const handleOnboardingSubmit = async () => {
    if (!user) return
    
    const validHabits = habitInputs.filter(habit => habit.trim() !== '')
    if (validHabits.length === 5) {
      try {
        // Insert habits into database
        const habitsToInsert = validHabits.map(name => ({
          user_id: user.id,
          name: name.trim()
        }))

        const { data: newHabits, error } = await supabase
          .from('habits')
          .insert(habitsToInsert)
          .select()

        if (error) throw error

        if (newHabits) {
          setHabits(newHabits)
          setTracker({})
          const weekStart = getCurrentWeekStart()
          setWeekStartDate(weekStart)
          setIsOnboarding(false)
        }
      } catch (error) {
        console.error('Error creating habits:', error)
        alert('Error creating habits. Please try again.')
      }
    }
  }

  const toggleHabit = async (habitId: string, day: string) => {
    if (!user) return
    
    // Calculate the date for this day
    const dayIndex = DAYS.indexOf(day)
    const date = new Date(weekStartDate)
    date.setDate(date.getDate() + dayIndex)
    const dateStr = date.toISOString().split('T')[0]
    
    const currentValue = tracker[habitId]?.[day] || false
    const newValue = !currentValue

    try {
      if (currentValue) {
        // Delete the entry
        await supabase
          .from('habit_entries')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', user.id)
          .eq('date', dateStr)
      } else {
        // Insert new entry
        await supabase
          .from('habit_entries')
          .insert({
            habit_id: habitId,
            user_id: user.id,
            date: dateStr,
            completed: true
          })
      }

      // Update local state
      setTracker(prev => ({
        ...prev,
        [habitId]: {
          ...prev[habitId],
          [day]: newValue
        }
      }))
    } catch (error) {
      console.error('Error toggling habit:', error)
    }
  }

  const resetWeek = async () => {
    if (!user) return
    
    try {
      // Delete user's habits and entries
      await supabase.from('habit_entries').delete().eq('user_id', user.id)
      await supabase.from('habits').delete().eq('user_id', user.id)
      
      setIsOnboarding(true)
      setHabits([])
      setTracker({})
      setHabitInputs(['', '', '', '', ''])
    } catch (error) {
      console.error('Error resetting data:', error)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const downloadStats = () => {
    const stats = habits.map(habit => {
      const habitStats = DAYS.map(day => tracker[habit.id]?.[day] ? 1 : 0)
      const total = habitStats.reduce((sum: number, val: number) => sum + val, 0)
      const statData: { [key: string]: number | string } = {
        habit: habit.name,
        total,
        percentage: Math.round((total / 7) * 100)
      }
      
      DAYS.forEach((day, i) => {
        statData[day] = habitStats[i]
      })
      
      return statData
    })

    const csvContent = [
      ['Habit', ...DAYS, 'Total', 'Percentage'].join(','),
      ...stats.map(stat => [
        stat.habit,
        ...DAYS.map(day => stat[day] as number),
        stat.total,
        `${stat.percentage}%`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habit-tracker-${weekStartDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getWeeklyProgress = () => {
    const totalPossible = habits.length * 7
    const totalCompleted = habits.reduce((sum, habit) => {
      return sum + DAYS.reduce((daySum, day) => {
        return daySum + (tracker[habit.id]?.[day] ? 1 : 0)
      }, 0)
    }, 0)
    return totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuthSuccess={() => setLoading(false)} />
  }

  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-8">
            <div className="text-center flex-1">
              <Target className="mx-auto h-16 w-16 text-indigo-600 mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Weekly Habit Tracker</h1>
              <p className="text-gray-600">Set 5 habits you want to track this week</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
          
          <div className="space-y-4 mb-8">
            {habitInputs.map((habit, index) => (
              <div key={index} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Habit {index + 1}
                </label>
                <input
                  type="text"
                  value={habit}
                  onChange={(e) => {
                    const newInputs = [...habitInputs]
                    newInputs[index] = e.target.value
                    setHabitInputs(newInputs)
                  }}
                  placeholder={`Enter habit ${index + 1}...`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={handleOnboardingSubmit}
            disabled={habitInputs.filter(h => h.trim()).length !== 5}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Start Tracking
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Weekly Habit Tracker</h1>
                <p className="text-gray-600">Week starting {new Date(weekStartDate).toLocaleDateString()}</p>
                <p className="text-sm text-gray-500">Welcome back, {user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-lg font-medium">
                {getWeeklyProgress()}% Complete
              </div>
              <button
                onClick={downloadStats}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </button>
              <button
                onClick={resetWeek}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reset</span>
              </button>
              <button
                onClick={signOut}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Habit Tracker Grid */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-900 min-w-[200px]">
                    Habits
                  </th>
                  {DAYS.map(day => (
                    <th key={day} className="px-4 py-4 text-center text-sm font-medium text-gray-900 min-w-[100px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {habits.map(habit => (
                  <tr key={habit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{habit.name}</div>
                    </td>
                    {DAYS.map(day => (
                      <td key={day} className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleHabit(habit.id, day)}
                          className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-indigo-500 transition-colors flex items-center justify-center"
                        >
                          {tracker[habit.id]?.[day] ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                          ) : (
                            <Circle className="h-6 w-6 text-gray-400" />
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {habits.map(habit => {
            const completed = DAYS.reduce((sum, day) => sum + (tracker[habit.id]?.[day] ? 1 : 0), 0)
            const percentage = Math.round((completed / 7) * 100)
            
            return (
              <div key={habit.id} className="bg-white rounded-lg shadow p-4">
                <h3 className="font-medium text-gray-900 mb-2 truncate" title={habit.name}>
                  {habit.name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-indigo-600">{completed}/7</span>
                  <span className="text-sm text-gray-600">{percentage}%</span>
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
