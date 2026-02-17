import { Request, Response } from 'express'
import prisma from '../lib/prisma.js';
import openai from '../Configs/openai.js';
import { role } from 'better-auth/plugins';
import Stripe from "stripe"

// Get User Credits
export const getUserCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if(!userId){
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const user = await prisma.user.findUnique({
        where: {id: userId}
      })
      
      res.json({credits: user?.credits})
      } catch (error : any) {
        console.log(error.code || error.message);
        res.status(500).json({ message: error.message });
      }
      }
      
      //Controller function to create a New Project//
      export const createUserProject = async (req: Request, res: Response) => {
        const userId = req.userId;
        try {
          const { initial_prompt } = req.body;
      
          if(!userId){
            return res.status(401).json({ message: 'Unauthorized' });
          }
      
          const user = await prisma.user.findUnique({
            where: {id: userId}
          })
      
          if(user && user.credits < 5){
            return res.status(403).json({ message: 'add credits to create more projects' });
          }
          
          // Create a new project
          const project = await prisma.websiteProject.create({
            data: {
              name: initial_prompt.length > 50 ? initial_prompt.substring(0, 47)
                + '...' : initial_prompt,
              initial_prompt,
              userId
            }
          })
          
          //update user total ceation
            // Update User's Total creation
await prisma.user.update({
    where: {id: userId},
    data: {totalCreation: {increment: 1}}
  })
  
  await prisma.conversation.create({
    data: {
      role: 'user',
      content: initial_prompt,
      projectId: project.id
    }
  })
   
  await prisma.user.update({
    where: {id: userId},
    data: {credits: {decrement: 5}}
  })
  
  // Enhance user prompt
const promptEnhanceResponse = await openai.chat.completions.create({
    model: 'arcee-ai/trinity-large-preview:free',
    messages: [
      {
        role: 'system',
        content: `
        You are a prompt enhancement specialist. Take the user's
website request and expand it into a detailed, comprehensive
prompt that will help create the best possible website.

Enhance this prompt by:
1. Adding specific design details (layout, color scheme,
typography)
2. Specifying key sections and features
3. Describing the user experience and interactions
4. Including modern web design best practices
5. Mentioning responsive design requirements
6. Adding any missing but important elements

Return ONLY the enhanced prompt, nothing else. Make it detailed
but concise (2-3 paragraphs m
`
      },
      {
       role: 'user',
       content: initial_prompt
      }
    ]
  })
  
  const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;
await prisma.conversation.create({
  data: {
    role: 'assistant',
    content: `I've enhanced your prompt to: "${enhancedPrompt}"`,
    projectId: project.id
  }
})

await prisma.conversation.create({
  data: {
    role: 'assistant',
    content: 'now generating your website..!',
    projectId: project.id
  }
})


// generate website code
const codeGenerationResponse = await openai.chat.completions.create({
    model: 'arcee-ai/trinity-large-preview:free',
    messages: [
      {
        role: 'system',
        content: `
        You are a prompt enhancement specialist. Take the user's
website request and expand it into a detailed, comprehensive
prompt that will help create the best possible website.

Enhance this prompt by:
1. Adding specific design details (layout, color scheme,
typography)
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
        content: enhancedPrompt || ''
      }
    ]
  })
  
  const code= codeGenerationResponse.choices[0].message.content || '';
    
  if(!code) {
    await prisma.conversation.create({
      data: {
        role: 'assistant',
        content : "Unable to generate the code . Please try again",
        projectId : project.id
      }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: 5 } }
    });
    return;
  }

  // Create Version for the project
const version = await prisma.version.create({
    data: {
      code: code.replace(/```[a-z]*\n?/gi, "")
        .replace(/```/g, "")
        .trim(),
      description: 'Initial version',
      projectId: project.id
    }
  })
  
  await prisma.conversation.create({
    data: {
      role: 'assistant',
      content: "I've created your website! You can now preview it and request any changes.",
      projectId: project.id
    }
  })
  
          
  await prisma.websiteProject.update({
    where: {id: project.id},
    data: {
      current_code: code.replace(/```[a-z]*\n?/gi, '')
        .replace(/```/g, '')
        .trim(),
      current_version_index: version.id
    }
  })
  


        } catch (error : any) {
            await prisma.user.update({
                where: {id: userId},
                data: {credits: {increment: 5}}
            })
          console.log(error.code || error.message);
          res.status(500).json({ message: error.message });
        }
      }
      
// Controller Function to Get a single User Project
export const getUserProject = async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      if(!userId){
          return res.status(401).json({ message: 'Unauthorized' });
        }
        
const {project} = req.params;

        const user = await prisma.websiteProject.findUnique({
          where: {id: userId},
          include:{
            conversation: {
                orderBy: {timestamp: 'asc'}
            },
            versions:{orderBy: {timestamp: 'asc'}}
          }
        })
        
        res.json({project})
        } catch (error : any) {
          console.log(error.code || error.message);
          res.status(500).json({ message: error.message });
        }
        }
        


        // Controller Function to Get a ALL User Project
export const getUserProjects = async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      if(!userId){
          return res.status(401).json({ message: 'Unauthorized' });
        }
        
        const projects = await prisma.websiteProject.findMany({
          where: {id: userId},
          orderBy: {updatedAt: 'desc'}
        })
        
        res.json({projects})
        } catch (error : any) {
          console.log(error.code || error.message);
          res.status(500).json({ message: error.message });
        }
        }

//Controller function to toggle proejct publish 
// Controller function to toggle project publish
export const togglePublish = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ✅ FIX 1: force projectId to string
    const projectId = req.params.projectId as string;

    // ✅ FIX 2: use findFirst (NOT findUnique)
    const project = await prisma.websiteProject.findFirst({
      where: {
        id: projectId,
        userId: userId,
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const updatedProject = await prisma.websiteProject.update({
      where: {
        id: project.id, // ✅ always safe
      },
      data: {
        isPublished: !project.isPublished,
      },
    });

    return res.json({
      message: updatedProject.isPublished
        ? "Project Published"
        : "Project Unpublished",
    });

  } catch (error: any) {
    console.error(error.message);
    return res.status(500).json({ message: error.message });
  }
};


        // Contoller Function to Puchase Credits 
        export const purchaseCredits = async (req: Request, res: Response) => {
          try {
            interface Plan {
              credits: number;
              amount: number;
            }
          
            const plans: Record<string, Plan> = {
              basic: { credits: 100, amount: 5 },
              pro: { credits: 400, amount: 19 },
              enterprise: { credits: 1000, amount: 49 },
            };
          const userId = req.userId;
          const { planId } = req.body as {
            planId: keyof typeof plans;
          };
          

          const origin = req.headers.origin as string;
          const plan: Plan = plans[planId];
          
          if (!plan) {
            return res.status(404).json({
              message: "Plan not found",
            });
          }
          
          const transaction = await prisma.transaction.create({
            data: {
              userId: userId!,
              planId: req.body.planId,
              amount: plan.amount,
              credits: plan.credits,
            }
          })
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
          const session = await stripe.checkout.sessions.create({
            success_url: `${origin}/loading`,
            cancel_url:`${origin}`,
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  product_data:{
                    name:`AiSiteBuilder - ${plan.credits} credits`
                  },
                  unit_amount: Math.floor(transaction.amount) * 100
                },
                quantity: 1
              },
            ],
            mode: 'payment',
            metadata: {
              transactionId: transaction.id,
              appId: 'ai-site-builder',
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
          });
          res.json({
            payment_link: session.url,
          });
          
          } catch (error: any) {
            console.error(
              error?.code || error?.message
            );
          }
        }