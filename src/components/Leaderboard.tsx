import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal, Crown, Star } from 'lucide-react';
import { db } from '../firebase';
import { UserStats } from '../types';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('points', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        
        const list: UserStats[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data() as UserStats);
        });

        const mockList = getMockLeaders();
        const filteredMock = mockList.filter(
          (mock) => !list.some((real) => real.uid === mock.uid || real.email === mock.email)
        );
        const combined = [...list, ...filteredMock].sort((a, b) => b.points - a.points).slice(0, 10);
        setLeaders(combined);
      } catch (err) {
        console.warn('Leaderboard loading failed - presenting local defaults:', err);
        setLeaders(getMockLeaders());
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  const getMockLeaders = (): UserStats[] => [
    {
      uid: 'carlsen',
      email: 'magnus@chess.com',
      displayName: 'ماجنوس كارلسن 👑 (مستعار)',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=carlsen',
      wins: 1420,
      losses: 104,
      draws: 312,
      points: 2882,
      createdAt: ''
    },
    {
      uid: 'nakamura',
      email: 'hikaru@chess.com',
      displayName: 'هيكارو ناكامورا ⚡ (مستعار)',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=nakamura',
      wins: 1105,
      losses: 212,
      draws: 189,
      points: 2810,
      createdAt: ''
    },
    {
      uid: 'kasparov',
      email: 'garry@chess.com',
      displayName: 'غاري كاسباروف 🔥 (مستعار)',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=kasparov',
      wins: 980,
      losses: 82,
      draws: 120,
      points: 2795,
      createdAt: ''
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-100 font-sans tracking-tight">لوحة الشرف والمتصدرين</h3>
          <p className="text-xs text-slate-400">الترتيب العالمي للاعبين حسب النقاط المكتسبة</p>
        </div>
      </div>

      <div className="space-y-3">
        {leaders.map((leader, index) => {
          const isTopThree = index < 3;
          let rankColor = 'text-slate-400';
          let bgColor = 'bg-slate-950/40 border-slate-800/60';
          let Icon = Medal;

          if (index === 0) {
            rankColor = 'text-amber-400';
            bgColor = 'bg-amber-500/5 border-amber-500/20';
            Icon = Crown;
          } else if (index === 1) {
            rankColor = 'text-slate-300';
            bgColor = 'bg-slate-300/5 border-slate-300/20';
          } else if (index === 2) {
            rankColor = 'text-amber-700';
            bgColor = 'bg-amber-700/5 border-amber-700/10';
          }

          return (
            <div
              key={leader.uid}
              id={`leader_${leader.uid}`}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all hover:scale-[1.01] ${bgColor}`}
            >
              <div className="flex items-center gap-4">
                {/* Position Rank */}
                <div className={`w-8 flex justify-center items-center font-bold text-lg ${rankColor}`}>
                  {isTopThree ? (
                    <Icon className="w-6 h-6" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <img
                  src={leader.photoURL}
                  referrerPolicy="no-referrer"
                  alt={leader.displayName}
                  className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700"
                />

                {/* Info */}
                <div>
                  <h4 className="text-sm font-medium text-slate-100">{leader.displayName}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">{leader.email}</p>
                </div>
              </div>

              {/* Stats Section */}
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <span className="text-emerald-500 text-xs font-semibold">🏆 {leader.wins} فوز</span>
                  <span className="text-slate-500 text-xs mx-2">/</span>
                  <span className="text-rose-500 text-xs font-semibold">♟️ {leader.losses} خسارة</span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-semibold text-amber-500 font-mono">{leader.points}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
