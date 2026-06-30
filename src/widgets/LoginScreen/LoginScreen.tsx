import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { DAVClient } from 'tsdav';
import { useAuthStore, type AuthConfig } from '../../entities/auth/model/store';

type FormValues = {
  serverUrl: string;
  username: string;
  password: string;
};

export default function LoginScreen() {
  const setConfig = useAuthStore((s) => s.setConfig);
  const [authMethod, setAuthMethod] = useState<'Basic' | 'Digest'>('Basic');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { serverUrl: 'http://localhost:5232/', username: '', password: '' },
  });

  async function onSubmit(data: FormValues) {
    const url = data.serverUrl.trim().replace(/\/?$/, '/');
    try {
      const client = new DAVClient({
        serverUrl: url,
        credentials: { username: data.username.trim(), password: data.password },
        authMethod,
        defaultAccountType: 'caldav',
      });
      await client.login();
      await client.fetchCalendars();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Connection failed' });
      return;
    }
    const config: AuthConfig = {
      serverUrl: url,
      username: data.username.trim(),
      password: data.password,
      authMethod,
    };
    setConfig(config);
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-black mb-1">vcalendar</h1>
        <p className="text-sm text-gray-400 mb-8">Connect to your CalDAV server</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Server URL
            </label>
            <input
              type="url"
              {...register('serverUrl', { required: true })}
              placeholder="https://cal.example.com/"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-black placeholder-gray-300 outline-none focus:border-black transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Auth method
            </label>
            <div className="flex gap-2">
              {(['Basic', 'Digest'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAuthMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    authMethod === m
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Username
            </label>
            <input
              type="text"
              {...register('username', { required: true })}
              autoComplete="username"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-black placeholder-gray-300 outline-none focus:border-black transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Password
            </label>
            <input
              type="password"
              {...register('password', { required: true })}
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-black placeholder-gray-300 outline-none focus:border-black transition-colors"
            />
          </div>

          {errors.root && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              {errors.root.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full bg-black text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {isSubmitting ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
