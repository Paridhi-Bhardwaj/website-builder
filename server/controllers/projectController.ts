import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import openai from '../Configs/openai.js';
import { Version } from '../src/generated/client/browser.js';


/**
 * Controller Function to Make Revision
 * Handles website revision with credit deduction
 */
export const makeRevision = async (req: Request, res: Response) => {
  const userId = req.userId;

  try {
    const { projectId } = req.params as { projectId: string };
    const { message } = req.body;
    

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'please enter a valid prompt' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.credits < 5) {
      return res.status(403).json({ message: 'add more credits to make changes' });
    }

    const currentProject = await prisma.websiteProject.findUnique({
      where: {
        id: projectId,
        userId
      },
      include: { versions: true }
    });

    if (!currentProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await prisma.conversation.create({
      data: {
        role: 'user',
        content: message,
        projectId
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 5 } }
    });

    // Enhance user prompt
    const promptEnhancerResponse = await openai.chat.completions.create({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [
        {
          role: 'system',
          content: `You are a prompt enhancement specialist. Take the user's
website request and expand it into a detailed, comprehensive
prompt that will help create the best possible website.

Enhance this prompt by:
1. Adding specific design details (layout, color scheme, typography)
2. Specifying key sections and features
3. Describing the user experience and interactions
4. Including modern web design best practices
5. Mentioning responsive design requirements
6. Adding any missing but important elements

Return ONLY the enhanced prompt, nothing else. Make it detailed
but concise (2-3 paragraphs max).`
        },
        {
          role: 'user',
          content: `user's request: "${message}"`
        }
      ]
    });

    const enhancedPrompt =
      promptEnhancerResponse.choices[0].message.content || '';

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
        projectId
      }
    });

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: 'Now making changes to your website...',
        projectId
      }
    });

    // Generate website code
    const codeGenerationResponse = await openai.chat.completions.create({
      model: 'arcee-ai/trinity-large-preview:free',
      messages: [
        {
          role: 'system',
          content: `You are an expert web developer.

CRITICAL REQUIREMENTS:
- Return ONLY the complete updated HTML code with the requested changes.
- Use Tailwind CSS for ALL styling (NO custom CSS).
- Use Tailwind utility classes for all styling changes.
- Include all JavaScript in <script> tags before closing </body>.
- Make sure it's a complete, standalone HTML document with Tailwind CSS.
- Return the HTML code only, nothing else.

Apply the requested changes while maintaining the Tailwind CSS styling approach.`
        },
        {
          role: 'user',
          content: `Here is the current website code: "${currentProject.current_code}"
The user wants this change: "${enhancedPrompt}"`
        }
      ]
    });

    const code =
      codeGenerationResponse.choices[0].message.content || '';


      if(!code) {
        await prisma.conversation.create({
          data: {
            role: 'assistant',
            content : "Unable to generate the code . Please try again",
            projectId 
          }
        });
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: 5 } }
        });
        return;
      }

    const cleanedCode = code
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim();

    const newVersion = await prisma.version.create({
      data: {
        code: cleanedCode,
        description: 'Revision update',
        projectId
      }
    });

    await prisma.websiteProject.update({
      where: { id: projectId },
      data: {
        current_code: cleanedCode,
        current_version_index: newVersion.id
      }
    });

    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content: "I've made the changes to your website! You can now preview it.",
        projectId
      }
    });

    res.json({ credits: user.credits - 5 });
  } catch (error: any) {
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 5 } }
      });
    }

    console.log(error.code || error.message);
    res.status(500).json({ message: error.message });
  }
};


// Controller function to rollback to a specific version
// Controller function to rollback to a specific version
export const rollbackToVersion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ FIX 1: extract params safely
    const projectId = req.params.projectId as string;
    const versionId = req.params.versionId as string;

    // ✅ FIX 2: use findFirst + include versions
    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
      include: {
        versions: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // ✅ FIX 3: correct version typing
    const version = project.versions.find(
      (v: Version) => v.id === versionId
    );

    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }

    // ✅ FIX 4: update by UNIQUE id only
    await prisma.websiteProject.update({
      where: {
        id: project.id,
      },
      data: {
        current_code: version.code,
        current_version_index: version.id,
      },
    });

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content:
          "I've rolled back your website to the selected version. You can now preview it.",
        projectId: project.id,
      },
    });

    return res.json({ message: "Version rolled back successfully" });
  } catch (error: any) {
    console.error(error.message);
    return res.status(500).json({ message: error.message });
  }
};



//Controller function to delete a Project
// Controller function to delete a Project
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ FIX 1: cast projectId to string
    const projectId = req.params.projectId as string;

    // ✅ FIX 2: use findFirst (not findUnique)
    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // ✅ FIX 3: delete using UNIQUE field only
    await prisma.websiteProject.delete({
      where: {
        id: project.id,
      },
    });

    await prisma.conversation.create({
      data: {
        role: "assistant",
        content: "Your project has been deleted successfully.",
        projectId: project.id,
      },
    });

    return res.json({ message: "Project deleted successfully" });
  } catch (error: any) {
    console.error(error.message);
    return res.status(500).json({ message: error.message });
  }
};



// Controller for getting project code for preview
export const getProjectPreview = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId as string;


    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
      include: {
        versions: true,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      project
    });
  } catch (error: any) {
    console.error(error.code || error.message);
    return res.status(500).json({ message: error.message });
  }
};

// Controller for getting published projects
export const getPublishedProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.websiteProject.findMany({
      where: {
        isPublished: true,
      },
      include: {
        user: true,
      },
    });

    return res.json({ projects });
  } catch (error: any) {
    console.error(error.code || error.message);
    return res.status(500).json({ message: error.message });
  }
};

// Get a single published project by id
export const getProjectById = async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId as string;


    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
      },
    });

    if (!project || project.isPublished === false || !project.current_code) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      project,
      code: project.current_code,
    });
  } catch (error: any) {
    console.error(error.code || error.message);
    return res.status(500).json({ message: error.message });
  }
};

//Controller to save project 
// Controller to save project code
export const saveProjectCode = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId as string;

    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!code) {
      return res.status(400).json({ message: "Code is required" });
    }

    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await prisma.websiteProject.update({
      where: {
        id: project.id,
        userId: userId,
      },
      data: {
        current_code: code, current_version_index:''
      },
    });

    return res.json({ message: "Project code saved successfully" });
  } catch (error: any) {
    console.error(error.code || error.message);
    return res.status(500).json({ message: error.message });
  }
};
