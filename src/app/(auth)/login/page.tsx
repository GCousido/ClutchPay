'use client';

import { signIn } from "next-auth/react";
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type FormData = {
  email: string;
  password: string;
};

function LoginPage() {
  const t = useTranslations('login'); // 'login' is the JSON namespace

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const router = useRouter()

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    setSubmitSuccess('');
    
    const res = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (!res.ok) {
      // TODO: add res.error handling
      setSubmitError(t('incorrectCredentials'));
      return;
    } else {
      // FIXME: show success message or not?
      setSubmitSuccess(t('loginSuccess'));
      // TODO: redirect to dashboard or another page
      router.push('/dashboard')
      router.refresh()
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-full">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md"
      >
        <h2 className="text-2xl font-semibold text-green-700 mb-6 text-center">
          {t('login')}
        </h2>
        {/* TODO:  Error messages and temp values when error */}
        <label className="block mb-4">
          <input
            {...register('email', { required: t('requiredEmail') })}
            placeholder={t('email')}
            type="email"
            className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {errors.email && <p className="text-red-600 mt-1 text-sm">{errors.email.message}</p>}
        </label>

        <label className="block mb-6">
          <input
            {...register('password', { required: t('requiredPassword') })}
            placeholder={t('password')}
            type="password"
            className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {errors.password && <p className="text-red-600 mt-1 text-sm">{errors.password.message}</p>}
        </label>

        <Link
          href="/register"
          className="mb-4 w-full block text-center bg-white border border-green-600 text-green-600 font-semibold py-2 rounded-md hover:bg-green-50 transition"
        >
          {t('goToRegister')}
        </Link>


        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-md transition-colors"
        >
          {t('signIn')}
        </button>

        {submitError && <p className="mt-4 text-center text-red-600">{submitError}</p>}
        {submitSuccess && <p className="mt-4 text-center text-green-700">{submitSuccess}</p>}
      </form>
    </div>
  );
}

export default LoginPage;
