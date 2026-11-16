import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/app/lib/dal";
import { getExerciseById } from "@/server/exercises/exercise.service";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/exercises/[id]">,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "id is required",
        },
        {
          status: 400,
        },
      );
    }

    const exercise = await getExerciseById(id, user.id);

    if (!exercise) {
      return NextResponse.json(
        {
          success: false,
          error: "Exercise not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: exercise,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error("GET /api/exercises/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch exercise",
      },
      {
        status: 500,
      },
    );
  }
}
