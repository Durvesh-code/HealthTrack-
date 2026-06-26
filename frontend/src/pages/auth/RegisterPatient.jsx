import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useTranslation } from '../../i18n';
import api from '../../config/api';

const RegisterPatient = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    email: '',
    password: '',
    gender: '',
    contact: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await api.post('/auth/register/patient', formData);
      if (response.data.success) {
        toast.success(t('common.success') + '! Please login.');
        navigate('/login');
      } else {
        toast.error(response.data.message || t('common.error'));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-slate px-6 py-8">
      <div className="w-full max-w-lg animate-fadeInUp">
        <div className="bg-white rounded-[14px] p-10 shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-center">
          <div className="mb-6">
            <img
              src="/images/logo.png"
              alt="HealthTrack+ Logo"
              className="w-[70px] h-[70px] mx-auto mb-2.5"
              onError={(e) => { e.target.src = 'https://via.placeholder.com/70?text=ML'; }}
            />
            <h2 className="text-2xl font-bold text-accent-blue mb-1">
              {t('nav.registerPatient')}
            </h2>
            <p className="text-[0.95rem] text-text-muted">
              {t('Join HealthTrack+ to manage your health records with ease 🏥')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="text-left">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  👤 {t('common.name')}
                </label>
                <input
                  type="text" name="name" value={formData.name} onChange={handleChange} required
                  className={`w-full px-3 py-2.5 rounded-lg border ${errors.name ? 'border-red-500' : 'border-border-light'} text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none`}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  🎂 {t('doctor.age')}
                </label>
                <input
                  type="number" name="age" value={formData.age} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-border-light text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  📧 {t('common.email')}
                </label>
                <input
                  type="email" name="email" value={formData.email} onChange={handleChange} required
                  className={`w-full px-3 py-2.5 rounded-lg border ${errors.email ? 'border-red-500' : 'border-border-light'} text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none`}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  🔑 {t('auth.password')}
                </label>
                <input
                  type="password" name="password" value={formData.password} onChange={handleChange} required
                  className={`w-full px-3 py-2.5 rounded-lg border ${errors.password ? 'border-red-500' : 'border-border-light'} text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none`}
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  🚻 {t('doctor.gender')}
                </label>
                <input
                  type="text" name="gender" value={formData.gender} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-border-light text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  📞 {t('common.contact')}
                </label>
                <input
                  type="text" name="contact" value={formData.contact} onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-border-light text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                🏠 {t('Address')}
              </label>
              <textarea
                name="address" value={formData.address} onChange={handleChange} rows={2}
                className="w-full px-3 py-2.5 rounded-lg border border-border-light text-[0.95rem] focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:scale-[1.02] transition-all outline-none resize-y min-h-[60px]"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-semibold text-base bg-gradient-to-r from-accent-blue to-green-500 hover:from-green-500 hover:to-accent-blue hover:scale-[1.03] hover:shadow-lg transition-all ${loading ? 'opacity-70 cursor-not-allowed animate-pulse' : ''}`}
            >
              {loading ? t('common.loading') : t('auth.createAccount')}
            </button>
          </form>

          <div className="mt-5 text-[0.9rem]">
            <p className="text-text-muted">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-accent-blue font-semibold hover:underline">
                {t('nav.login')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPatient;