import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Folder, Clock, MessageSquare, Sparkles, BarChart2, Settings, Sun, Moon, Circle } from 'lucide-react';
import { ThemeContext } from '../App';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Overview', end: true },
  { path: '/projects', icon: Folder, label: 'Projects' },
  { path: '/sessions', icon: Clock, label: 'Sessions' },
  { path: '/brain-dumps', icon: MessageSquare, label: 'Brain Dumps' },
  { path: '/ai-synthesis', icon: Sparkles, label: 'AI Synthesis' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
];

function Sidebar() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <nav
      style={{ width: 220 }}
      className="fixed left-0 top-0 h-full border-r border-outline bg-surface flex flex-col z-50"
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-outline">
        <h1
          style={{ fontFamily: 'Space Grotesk', fontWeight: 900, letterSpacing: '-0.02em' }}
          className="text-lg text-primary-container uppercase tracking-tight"
        >
          ContextSwitch
        </h1>
        <p className="font-label-mono-xs text-on-surface-variant uppercase mt-0.5 text-[10px] tracking-widest">
          Developer Dashboard
        </p>
      </div>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col pt-3 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 mb-0.5 font-mono text-xs uppercase tracking-wider transition-all duration-150 ${
                isActive
                  ? 'text-primary-container border-l-2 border-primary-container bg-surface-dim'
                  : 'text-tertiary hover:bg-surface-dim hover:text-on-surface border-l-2 border-transparent'
              }`
            }
          >
            <item.icon size={16} strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Bottom */}
      <div className="border-t border-outline p-3 flex flex-col gap-0.5">
        <div className="flex items-center gap-3 px-3 py-2 text-tertiary font-mono text-xs uppercase tracking-wider cursor-pointer hover:bg-surface-dim">
          <Circle size={16} strokeWidth={1.5} className="text-[color:var(--color-success)] fill-[color:var(--color-success)]" />
          Agent Online
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 text-tertiary font-mono text-xs uppercase tracking-wider cursor-pointer transition-all duration-150 ${
              isActive ? 'text-primary-container border-l-2 border-primary-container bg-surface-dim' : 'hover:bg-surface-dim border-l-2 border-transparent'
            }`
          }
        >
          <Settings size={16} strokeWidth={1.5} />
          Settings
        </NavLink>
        <div
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 text-tertiary font-mono text-xs uppercase tracking-wider cursor-pointer hover:bg-surface-dim"
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </div>
      </div>
    </nav>
  );
}

export default Sidebar;
