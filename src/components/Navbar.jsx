import React from 'react';

const Navbar = () => {
  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center cursor-pointer">
            <span className="text-3xl font-extrabold text-indigo-600 tracking-tight">
              RoomDate
            </span>
          </div>

          {/* Menu Desktop */}
          <div className="hidden md:flex space-x-8 items-center">
            <a href="#" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
              Home
            </a>
            <a href="#" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
              Trova Stanza
            </a>
            <a href="#" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
              Cerca Coinquilini
            </a>
          </div>

          {/* Bottoni Login / Registrati */}
          <div className="hidden md:flex space-x-4 items-center">
            <button className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">
              Accedi
            </button>
            <button className="bg-indigo-600 text-white px-5 py-2 rounded-full hover:bg-indigo-700 transition-colors font-medium shadow-sm">
              Registrati
            </button>
          </div>

          {/* Bottone Menu Mobile (Hamburger) */}
          <div className="md:hidden flex items-center">
            <button className="text-gray-600 hover:text-indigo-600 focus:outline-none">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;