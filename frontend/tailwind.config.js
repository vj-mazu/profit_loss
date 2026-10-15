/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Navy Blue Theme - Primary Colors
        primary: {
          DEFAULT: '#1e3a8a',    // Navy blue for headers, primary buttons
          dark: '#1e40af',       // Darker variant for gradients
          light: '#0284c7'       // Light blue for accents, focus states
        },
        
        // Excel Colors - Data presentation
        excel: {
          header: '#1E293B',     // Dark slate for Excel-style headers
          grid: '#E2E8F0',       // Light slate for grid lines
          accent: '#0F766E',     // Teal accent
          inward: '#16A34A',     // Green for inward/purchase data
          sale: '#DC2626'        // Red for outward/sales data
        },
        
        // Semantic Colors
        semantic: {
          success: '#16a34a',    // Green for positive states
          warning: '#eab308',    // Yellow/amber for warnings
          error: '#dc2626',      // Red for errors
          info: '#0284c7'        // Light blue for informational messages
        },
        
        // Legacy colors (keeping for backward compatibility)
        erp: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        sage: {
          50: '#f4f7f5',
          100: '#e5ece7',
          500: '#52796f',
          800: '#2f3e46',
          900: '#1b262c',
        },
      },
      
      // Custom Border Radius Scale (6px-24px range)
      borderRadius: {
        'sm': '0.375rem',      // 6px - for small elements
        'DEFAULT': '0.5rem',   // 8px - for buttons, inputs
        'md': '0.625rem',      // 10px - for cards
        'lg': '0.75rem',       // 12px - minimum for cards
        'xl': '1rem',          // 16px - for large cards
        '2xl': '1.5rem',       // 24px - maximum for cards
        '3xl': '1.5rem',       // 24px - alias for max card radius
        'full': '9999px'       // for pills, avatars
      },
      
      // Custom Shadow Scale
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'DEFAULT': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'md': '0 6px 8px -2px rgba(0, 0, 0, 0.1), 0 4px 6px -3px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        'none': 'none'
      },
      
      // Custom Animation Keyframes
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'fadeOut': 'fadeOut 0.3s ease-in-out',
        'slideInRight': 'slideInRight 0.3s ease-out',
        'slideInLeft': 'slideInLeft 0.3s ease-out',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite'
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(10px)' }
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        }
      },
      
      // Custom Spacing Units (beyond Tailwind defaults if needed)
      spacing: {
        '18': '4.5rem',        // 72px
        '22': '5.5rem',        // 88px
        '26': '6.5rem',        // 104px
        '30': '7.5rem',        // 120px
        '34': '8.5rem',        // 136px
        '38': '9.5rem',        // 152px - minimum touch target height
      },
      
      // Additional custom utilities
      transitionDuration: {
        '0': '0ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      }
    },
  },
  plugins: [],
};
