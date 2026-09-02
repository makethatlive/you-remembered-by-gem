import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn, Loader2, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function Login() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await base44.entities.User.list(null, 100);
        setUsers(allUsers);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users. Make sure the server is running.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const handleLogin = (user) => {
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      full_name: user.fullName || user.email.split('@')[0]
    };
    
    login(userData);
    navigate('/');
  };

  if (loading) {
    return (
      <AuthLayout
        icon={LogIn}
        title="Loading..."
        subtitle="Fetching users from database"
      >
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={LogIn}
      title="Select User (Dev Login)"
      subtitle="Choose a user to log in as"
      footer={
        <>
          Local development login - select any user from the database
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {users.length === 0 && !error ? (
        <div className="text-center py-8 text-muted-foreground">
          No users found in database. Run the CSV import script first.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleLogin(user)}
              className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {user.fullName || user.email.split('@')[0]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                </div>
                <div className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {user.role}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 text-center text-xs text-muted-foreground">
        <p>💡 This is a development-only login system</p>
        <p className="mt-1">In production, proper authentication will be required</p>
      </div>
    </AuthLayout>
  );
}
