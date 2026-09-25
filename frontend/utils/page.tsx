import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// Kept as a Supabase query example; this is not an application route.
export default async function SupabaseExample() {
  const supabase = createClient(await cookies());
  const { data: todos } = await supabase.from("todos").select();
  return <ul>{todos?.map((todo) => <li key={todo.id}>{todo.name}</li>)}</ul>;
}
