import { supabase } from "@/lib/supabaseClient";

/**
 * Fetches files associated with a specific user profile from the Supabase database.
 * Note: Supabase RLS will block this operation if the user is not the owner of the record.
 *
 * @param userProfileId - The ID of the user profile whose files we want to fetch.
 * @param page - The page number to fetch (50 items per page; default is 1).
 * @returns - An array of file objects associated with the user profile.
 */
export async function fetchUserFiles(userProfileId: string, page: number = 1) {
  const start = (page - 1) * 50;
  const end = start + 49;

  const { data, error } = await supabase
    .from("files")
    .select(`
      *,
      uploader:user_profiles!uploaded_by ( full_name )
    `, { count: "exact" })
    .eq("user_profile_id", userProfileId)
    .order("uploaded_at", { ascending: false })
    .range(start, end);

  if (error) throw error;
  return data;
}


/**
 * Uploads a file to the "documents" storage bucket and inserts a record into the "files" table.
 * Note: Supabase RLS will block this operation if the user is not the owner of the record.
 *
 * @param file - The file to be uploaded.
 * @param userProfileId - The ID of the user profile to which the file belongs.
 * @param tags - An optional array of tags for the file.
 * @returns - The inserted file record.
 */
export async function uploadUserFile(
  file: File,
  targetProfileId: string, // paciente
  uploadedById: string,    // doctor/enfermero/etc.
  tags?: string[],
) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${targetProfileId}/${fileName}`;

  const { data: storageData, error: storageError } = await supabase.storage
    .from("documents")
    .upload(filePath, file);
  if (storageError) throw storageError;

  const { data: publicUrlData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  // 🧪 Verifica los valores que estás enviando a la tabla `files`
  console.log("Uploading file metadata:", {
    user_profile_id: targetProfileId,
    uploaded_by: uploadedById,
    filename: file.name,
    url: publicUrlData.publicUrl,
    file_type: file.type,
    tags: tags,
  });

  const { data, error } = await supabase
    .from("files")
    .insert({
      user_profile_id: targetProfileId,
      uploaded_by: uploadedById,
      filename: file.name,
      url: publicUrlData.publicUrl,
      file_type: file.type,
      tags: tags,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}



// Supabase RLS Policy: Table is only accessible to authenticated users.
// Only the user who uploaded the file can access, update, or delete it.
// They cannot access, update, or delete files uploaded by other users.