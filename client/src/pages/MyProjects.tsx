import { useEffect, useState } from 'react'
import type { Project } from '../types'
import { Loader2Icon, PlusIcon, TrashIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import api from '@/configs/axios'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

const MyProjects = () => {
  const{data:session, isPending}= authClient.useSession()
    const [loading, setloading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const navigate = useNavigate()

  const fetchProjects = async () => {
    try {
      const { data } = await api.get("/api/user/projects");
      setProjects(data.projects);
      setloading(false);
    
    } catch (error: any) {
      console.error(error);
    
      toast.error(
        error?.response?.data?.message || error.message
      );
    }
    
  }

  const deleteProject = async (_MyProject: string) => {
    try {
      const confirm = window.confirm(
        "Are you sure you want to delete this project?"
      );
    
      if (!confirm) return;
    
      const { data } = await api.delete(
        `/api/project/${projects}`
      );
    
      toast.success(data.message);
      fetchProjects();
    
    } catch (error: any) {
      console.error(error);
    
      toast.error(
        error?.response?.data?.message || error.message
      );
    }
    
  }

  useEffect(() => {
    if(session?.user && !isPending)
    {fetchProjects()
  }else if( !isPending && !session?.user){
    navigate('/');
    toast('Please login to view your projects');
  }
  }, [
    session?.user
  ])

  return (
    <>
      <div className="px-4 md:px-16 lg:px-24 xl:px-32">
        {loading ? (
          <div className="flex items-center justify-center h-[80vh]">
            <Loader2Icon className="size-7 animate-spin text-indigo-200" />
          </div>
        ) : projects.length > 0 ? (
          <div className="py-10 min-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between mb-12">
              <h1 className="text-2xl font-medium text-white">My Projects</h1>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-white px-3 sm:px-6 py-1 sm:py-2 rounded bg-gradient-to-br from-indigo-500 to-indigo-600 hover:opacity-90 active:scale-95 transition-all"
              >
                <PlusIcon size={18} /> Create New
              </button>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group relative w-72 max-sm:mx-auto cursor-pointer
                             rounded-xl bg-white/5 backdrop-blur-md
                             border border-white/10
                             shadow-lg shadow-black/30
                             hover:border-indigo-500/40
                             transition-all duration-300"
                >
                  {/* Preview */}
                  <div className="relative h-40 w-full overflow-hidden rounded-t-xl border-b border-white/10 bg-black">
                    {project.current_code ? (
                      <iframe
                        srcDoc={project.current_code}
                        sandbox="allow-scripts allow-same-origin"
                        className="absolute top-0 left-0 w-[1200px] h-[800px] origin-top-left pointer-events-none"
                        style={{ transform: 'scale(0.25)' }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                        No Preview
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-2 text-white">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold line-clamp-2">
                        {project.name}
                      </h2>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300">
                        Website
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 line-clamp-2">
                      {project.initial_prompt}
                    </p>

                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-4 flex items-center justify-between text-xs text-gray-400"
                    >
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/preview/${project.id}`)}
                          className="rounded-md bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => navigate(`/projects/${project.id}`)}
                          className="rounded-md bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete */}
                  <TrashIcon
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteProject(project.id)
                    }}
                    className="absolute top-3 right-3 h-7 w-7 p-1.5
                               rounded-md bg-black/60 text-red-500
                               opacity-0 group-hover:opacity-100
                               transition cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[80vh]">
            <h1 className="text-3xl font-semibold text-gray-300">
              You have no Projects yet
            </h1>
            <button
              onClick={() => navigate('/')}
              className="text-white px-5 py-2 mt-5 rounded-md bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all"
            >
              Create New
            </button>
          </div>
        )}
      </div>

      <Footer />
    </>
  )
}

export default MyProjects
