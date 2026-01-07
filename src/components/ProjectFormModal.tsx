import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Project } from '../services/projectsService';

interface ProjectFormModalProps {
  isOpen: boolean;
  isDark?: boolean;
  project?: Project; // undefined for new, defined for edit
  onSubmit: (data: Omit<Project, 'projectId'>, imageFile?: File) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function ProjectFormModal({
  isOpen,
  isDark = false,
  project,
  onSubmit,
  onClose,
  isLoading = false
}: ProjectFormModalProps) {
  const [title, setTitle] = useState(project?.title || '');
  const [description, setDescription] = useState(project?.description || '');
  const [link, setLink] = useState(project?.link || '');
  const [linkText, setLinkText] = useState(project?.linkText || '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(project?.status || 'Active');
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [imagePreview, setImagePreview] = useState<string>(project?.imageUrl || '');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setImageFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    if (!imageFile) {
      setError('Image file is required');
      return;
    }

    const formData: Omit<Project, 'projectId'> = {
      title: title.trim(),
      description: description.trim(),
      imageUrl: '', // Will be populated from uploaded file
      link: link.trim() || undefined,
      linkText: linkText.trim() || undefined,
      status
    };

    onSubmit(formData, imageFile);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 text-white' : 'bg-white text-gray-900'
      }`}>
        {/* Header */}
        <div className={`p-6 flex items-center justify-between border-b ${
          isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50'
        }`}>
          <h2 className="text-lg font-bold">{project ? 'Edit Project' : 'Add New Project'}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-colors ${
              isDark 
                ? 'hover:bg-slate-700' 
                : 'hover:bg-gray-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Error Message */}
          {error && (
            <div className={`p-3 rounded-lg flex items-start gap-2 ${
              isDark 
                ? 'bg-red-900/20 border border-red-900/50 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-semibold mb-2">Project Image</label>
            
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(undefined);
                    setImagePreview('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className={`absolute top-2 right-2 p-2 rounded-lg ${
                    isDark 
                      ? 'bg-red-900/80 hover:bg-red-800 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full p-8 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center ${
                  isDark
                    ? 'border-slate-600 hover:border-orange-500 hover:bg-slate-800'
                    : 'border-gray-300 hover:border-orange-500 hover:bg-orange-50'
                }`}
              >
                <ImageIcon className="w-8 h-8 mb-2 text-orange-500" />
                <p className="text-sm font-medium">Click to upload image</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  PNG, JPG up to 5MB
                </p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500'
              } focus:outline-none`}
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description"
              rows={3}
              className={`w-full px-4 py-2 rounded-lg border transition-colors resize-none ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500'
              } focus:outline-none`}
              disabled={isLoading}
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-semibold mb-2">Project Link (Optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500'
              } focus:outline-none`}
              disabled={isLoading}
            />
          </div>

          {/* Link Text */}
          <div>
            <label className="block text-sm font-semibold mb-2">Link Button Text (Optional)</label>
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Learn More, View Project, etc."
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-orange-500'
              } focus:outline-none`}
              disabled={isLoading}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <div className="flex gap-2">
              {(['Active', 'Inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  disabled={isLoading}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                    status === s
                      ? s === 'Active'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : isDark
                      ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {project ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
