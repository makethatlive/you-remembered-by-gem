import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Verify Email Page
 * 
 * This page exists for backward compatibility but email verification
 * is not required in the base44 original flow.
 * Redirects to dashboard automatically.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard after 1 second
    const timer = setTimeout(() => {
      navigate('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#164E63] text-white rounded-full mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-serif text-gray-900 mb-2">Welcome!</h1>
        <p className="text-gray-600 mb-4">
          Redirecting you to your dashboard...
        </p>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#164E63] rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
