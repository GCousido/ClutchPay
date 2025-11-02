'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';


type FormData = {
  email: string;
  name: string;
  surname: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

function RegisterPage() {
  const t = useTranslations('register'); // 'register' is the JSON namespace

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>();

  const password = watch('password', '');

  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const onSubmit = async (data: FormData) => {
    setSubmitError('');
    setSubmitSuccess('');

    const { confirmPassword, ...payload } = data;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setSubmitError(t('failedRegister'));
        return;
      }
      setSubmitSuccess(t('successfulRegister'));
    } catch (error) {
      setSubmitError(t('failedRegister'));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="bg-white p-10 rounded-lg shadow-lg w-full max-w-md"
    >
      <h2 className="text-2xl font-semibold text-green-700 mb-6 text-center">
        {t('register')}
      </h2>
       {/* TODO: Validations and error messages */}
      <label className="block mb-4">
        <input
          {...register('email', {
            required: t('required'),
            pattern: {
              value:
                /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
              message: t('required'),
            },
          })}
          placeholder={t('email')}
          type="email"
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.email && (
          <p className="text-red-600 mt-1 text-sm">{errors.email.message}</p>
        )}
      </label>
      <label className="block mb-4">
        <input
          {...register('name', { required: t('required') })}
          placeholder={t('name')}
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.name && (
          <p className="text-red-600 mt-1 text-sm">{errors.name.message}</p>
        )}
      </label>
      <label className="block mb-4">
        <input
          {...register('surname', { required: t('required') })}
          placeholder={t('surnames')}
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.surname && (
          <p className="text-red-600 mt-1 text-sm">{errors.surname.message}</p>
        )}
      </label>
      <label className="block mb-4">
        <input
          {...register('phone')}
          placeholder={t('phone')}
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </label>
      <label className="block mb-4">
        <input
          {...register('password', {
            required: t('required'),
            minLength: {
              value: 6,
              message: t('required'),
            },
          })}
          placeholder={t('password')}
          type="password"
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.password && (
          <p className="text-red-600 mt-1 text-sm">{errors.password.message}</p>
        )}
      </label>
      <label className="block mb-6">
        <input
          {...register('confirmPassword', {
            required: t('required'),
            validate: (value) =>
              value === password || t('passwordMismatch'),
          })}
          placeholder={t('confirmPassword')}
          type="password"
          className="w-full px-4 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {errors.confirmPassword && (
          <p className="text-red-600 mt-1 text-sm">{errors.confirmPassword.message}</p>
        )}
      </label>
     <Link
          href="/login"
          className="mb-4 w-full block text-center bg-white border border-green-600 text-green-600 font-semibold py-2 rounded-md hover:bg-green-50 transition"
        >
          {t('goToLogin')}
      </Link>

      <button
        type="submit"
        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-md transition-colors"
      >
        {t('registerButton')}
      </button>
      {submitError && <p className="mt-4 text-center text-red-600">{submitError}</p>}
      {submitSuccess && <p className="mt-4 text-center text-green-700">{submitSuccess}</p>}
    </form>
  );
}

export default RegisterPage;
